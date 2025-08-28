import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENCY_SCOPE_META } from './idempotency.decorator';
import {
  IDEMPOTENCY_DEFAULTS,
  IDEMPOTENCY_HEADERS,
} from './idempotency.constants';
import { canonicalJsonStringify, isUuidV4, sha256Hex } from './idempotency.util';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta =
      this.reflector.get<string[] | string>(
        IDEMPOTENCY_SCOPE_META,
        context.getHandler(),
      ) || null;

    // Handler não idempotente → segue normal
    if (!meta) return next.handle();

    const allowed = Array.isArray(meta) ? meta : [meta];

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const tenantId: string | undefined = req.tenantId;
    const scopeHeader = String(req.headers[IDEMPOTENCY_HEADERS.SCOPE] || '');
    const keyHeader = String(req.headers[IDEMPOTENCY_HEADERS.KEY] || '');

    if (!tenantId) {
      throw new BadRequestException('tenantId ausente no contexto.');
    }

    // Valida cabeçalhos + sinônimos; checa presença de key
    this.service.validateHeadersOrThrow(allowed, scopeHeader, keyHeader);
    if (!isUuidV4(keyHeader)) {
      throw new BadRequestException('Idempotency-Key deve ser UUID v4.');
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
            requestHash,
          );

          // Sempre ecoar os headers idempotentes
          res.setHeader('Idempotency-Key', keyHeader);
          res.setHeader('Idempotency-Scope', scopeHeader);

          if (begin.action === 'REPLAY') {
            res.setHeader(IDEMPOTENCY_HEADERS.REPLAYED, 'true');
            res.status(begin.responseCode || HttpStatus.OK);
            subscriber.next(begin.responseBody ?? {});
            subscriber.complete();
            return;
          }

          if (begin.action === 'IN_PROGRESS') {
            res.setHeader(
              'Retry-After',
              String(IDEMPOTENCY_DEFAULTS.RETRY_AFTER_SECONDS),
            );
            res.status(HttpStatus.TOO_MANY_REQUESTS);
            subscriber.error(new Error('IDEMPOTENCY_IN_PROGRESS'));
            return;
          }

          // PROCEED → segue para o handler
          res.setHeader(IDEMPOTENCY_HEADERS.REPLAYED, 'false');

          next
            .handle()
            .pipe(
              tap(async (data) => {
                // Persistir snapshot (32 KB) e hints de recurso (orderId etc.)
                const resource = this.extractResource(effectiveScope, data);
                await this.service.succeed(
                  begin.recordId,
                  res.statusCode || HttpStatus.OK,
                  data,
                  resource,
                );
              }),
              catchError((err) => {
                const code =
                  (err?.response && (err.response.code || err.response?.message)) ||
                  err?.message ||
                  'UNEXPECTED_ERROR';
                const msg =
                  (err?.response && (err.response.message || err.response)) ||
                  err?.message;
                this.service
                  .fail(
                    begin.recordId,
                    String(code).slice(0, 60),
                    String(msg || '').slice(0, 500),
                  )
                  .catch(() => {});
                throw err;
              }),
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
    body: any,
  ): { resourceType?: string; resourceId?: string } {
    if (scope.startsWith('orders:') && body && typeof body === 'object') {
      const id = body.id ?? body.orderId ?? (Array.isArray(body.items) ? body.id : undefined);
      if (typeof id === 'string') {
        return { resourceType: 'order', resourceId: id };
      }
    }
    return {};
  }
}
