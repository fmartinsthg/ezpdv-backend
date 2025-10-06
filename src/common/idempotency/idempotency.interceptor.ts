// src/common/idempotency/idempotency.interceptor.ts
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { IdempotencyService } from "./idempotency.service";
import {
  IDEMPOTENCY_SCOPE_META,
  IDEMPOTENCY_FORBIDDEN,
} from "./idempotency.decorator";
import {
  IDEMPOTENCY_DEFAULTS,
  IDEMPOTENCY_HEADERS,
} from "./idempotency.constants";
import {
  canonicalJsonStringify,
  isUuidV4,
  sha256Hex,
} from "./idempotency.util";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: IdempotencyService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const raw = this.reflector.get<string[] | string>(
      IDEMPOTENCY_SCOPE_META,
      context.getHandler()
    );

    // Handler não idempotente → segue normal
    if (!raw) return next.handle();

    const allowed = Array.isArray(raw) ? raw : [raw];

    // Política FORBIDDEN: recusa qualquer header idempotente nesta rota
    const isForbidden =
      allowed.length === 1 && allowed[0] === IDEMPOTENCY_FORBIDDEN;

    const http = context.switchToHttp();
    const req = http.getRequest() as any;
    const res = http.getResponse();

    if (isForbidden) {
      const hasIdemHeaders =
        !!req.headers[IDEMPOTENCY_HEADERS.KEY] ||
        !!req.headers[IDEMPOTENCY_HEADERS.SCOPE];
      if (hasIdemHeaders) {
        throw new BadRequestException(
          "Escopo de idempotência não permitido para este endpoint."
        );
      }
      return next.handle();
    }

    const tenantId: string | undefined = req.tenantId;
    const scopeHeader = String(req.headers[IDEMPOTENCY_HEADERS.SCOPE] || "");
    const keyHeader = String(req.headers[IDEMPOTENCY_HEADERS.KEY] || "");

    if (!tenantId) {
      throw new BadRequestException("tenantId ausente no contexto.");
    }

    // Valida cabeçalhos + sinônimos; checa presença de key
    this.service.validateHeadersOrThrow(allowed, scopeHeader, keyHeader);
    if (!isUuidV4(keyHeader)) {
      throw new BadRequestException("Idempotency-Key deve ser UUID v4.");
    }

    // Hash determinístico do BODY
    const bodyString = canonicalJsonStringify(req.body ?? {});
    const requestHash = sha256Hex(bodyString);

    // Canoniza o escopo para persistir e fazer replay
    const effectiveScope = this.service.canonicalScope(scopeHeader);

    return new Observable((subscriber) => {
      (async () => {
        try {
          const begin = await this.service.beginOrReplay(
            tenantId,
            effectiveScope,
            keyHeader,
            requestHash
          );

          // Sempre ecoar os headers idempotentes para facilitar debug
          res.setHeader("Idempotency-Key", keyHeader);
          res.setHeader("Idempotency-Scope", scopeHeader);

          if (begin.action === "REPLAY") {
            res.setHeader(IDEMPOTENCY_HEADERS.REPLAYED, "true");
            res.status(begin.responseCode || HttpStatus.OK);
            subscriber.next(begin.responseBody ?? {});
            subscriber.complete();
            return;
          }

          if (begin.action === "IN_PROGRESS") {
            // Concorrência com a mesma key → 429 + Retry-After
            res.setHeader(
              "Retry-After",
              String(IDEMPOTENCY_DEFAULTS.RETRY_AFTER_SECONDS)
            );
            throw new HttpException(
              "IDEMPOTENCY_IN_PROGRESS",
              HttpStatus.TOO_MANY_REQUESTS
            );
          }

          // PROCEED → injeta contexto para @IdempotencyCtx()
          req.idempotency = {
            key: keyHeader,
            scope: effectiveScope,
            requestHash,
            recordId: begin.recordId,
          };
          res.setHeader(IDEMPOTENCY_HEADERS.REPLAYED, "false");

          next
            .handle()
            .pipe(
              tap(async (data) => {
                // Persistir snapshot e hints de recurso (orderId etc.)
                const resource = this.extractResource(effectiveScope, data);
                await this.service.succeed(
                  begin.recordId,
                  res.statusCode || HttpStatus.OK,
                  data,
                  resource
                );
              }),
              catchError((err) => {
                const code =
                  (err?.status ??
                    err?.response?.status ??
                    err?.code ??
                    "UNEXPECTED_ERROR") + "";
                const msg =
                  (err?.message ??
                    err?.response?.message ??
                    (typeof err?.response === "string" ? err.response : "")) +
                  "";
                this.service
                  .fail(begin.recordId, code.slice(0, 60), msg.slice(0, 500))
                  .catch(() => {});
                throw err;
              })
            )
            .subscribe({
              next: (v) => subscriber.next(v),
              error: (e) => subscriber.error(e),
              complete: () => subscriber.complete(),
            });
        } catch (e) {
          subscriber.error(e);
        }
      })();
    });
  }

  private extractResource(
    scope: string,
    body: any
  ): { resourceType?: string; resourceId?: string } {
    if (!body || typeof body !== "object") return {};
    // orders:* → prioriza id ou orderId
    if (scope.startsWith("orders:")) {
      const id = body.id ?? body.orderId;
      if (typeof id === "string")
        return { resourceType: "order", resourceId: id };
    }
    // payments:* → vincula ao orderId
    if (scope.startsWith("payments:")) {
      const oid = body.orderId ?? body.order?.id ?? body?.summary?.orderId;
      if (typeof oid === "string")
        return { resourceType: "order", resourceId: oid };
    }
    return {};
  }
}
