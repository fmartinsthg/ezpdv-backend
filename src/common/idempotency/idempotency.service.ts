import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma, IdempotencyStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  IDEMPOTENCY_ALLOWED_SCOPES,
  IDEMPOTENCY_DEFAULTS,
} from "./idempotency.constants";

export type BeginResult =
  | { action: "REPLAY"; responseCode: number; responseBody: any }
  | { action: "PROCEED"; recordId: string }
  | { action: "IN_PROGRESS" };

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Exposto para debug/telemetria se necessário */
  public readonly allowedScopes = IDEMPOTENCY_ALLOWED_SCOPES;

  /** Mapa de sinônimos → escopo CANÔNICO */
  private readonly scopeMap: Record<string, string> = {
    // Orders
    "orders:append-items": "orders:append-items",
    "orders:items:append": "orders:append-items",
    "orders:void-item": "orders:void-item",
    "orders:items:void": "orders:void-item",
    "orders:fire": "orders:fire",
    "orders:cancel": "orders:cancel",
    "orders:close": "orders:close",
    "orders:create": "orders:create",
    // Payments
    "payments:capture": "payments:capture",
    "payments:refund": "payments:refund",
    "payments:cancel": "payments:cancel",
    // Webhooks
    "webhooks:create:endpoints": "webhooks:endpoints:create",
    "webhooks:replay": "webhooks:replay",
  };

  /** Retorna a forma canônica do escopo (ou o próprio se não houver mapeamento). */
  public canonicalScope(input: string): string {
    const s = (input || "").trim();
    return this.scopeMap[s] || s;
  }

  /**
   * Valida headers de idempotência:
   *  - scopeHeader presente e pertencente ao conjunto permitido no handler (com sinônimos);
   *  - keyHeader presente.
   *  - (opcional) verifica também contra a allowlist global (defensivo).
   */
  public validateHeadersOrThrow(
    allowedFromHandler: string[] | string,
    scopeHeader?: string,
    keyHeader?: string
  ) {
    const allowed = Array.isArray(allowedFromHandler)
      ? allowedFromHandler
      : [allowedFromHandler];

    if (!scopeHeader) {
      throw new BadRequestException("Idempotency-Scope é obrigatório.");
    }
    const canonicalHeader = this.canonicalScope(scopeHeader);
    const canonicalAllowed = new Set(
      allowed.map((s) => this.canonicalScope(s))
    );

    if (!canonicalAllowed.has(canonicalHeader)) {
      throw new BadRequestException(
        "Escopo de idempotência não permitido para este endpoint."
      );
    }
    // Checagem extra contra allowlist global (hardening)
    if (!IDEMPOTENCY_ALLOWED_SCOPES.has(canonicalHeader)) {
      throw new BadRequestException(
        "Escopo de idempotência não é suportado globalmente."
      );
    }

    if (!keyHeader) {
      throw new BadRequestException("Idempotency-Key é obrigatório.");
    }
  }

  /**
   * Registra a chave (primeira vez) ou detecta condições de REPLAY/IN_PROGRESS/RETRY.
   * Sempre persiste escopo **canônico**.
   */
  public async beginOrReplay(
    tenantId: string,
    scope: string,
    key: string,
    requestHash: string
  ): Promise<BeginResult> {
    const canonical = this.canonicalScope(scope);
    if (!IDEMPOTENCY_ALLOWED_SCOPES.has(canonical)) {
      throw new BadRequestException("Escopo de idempotência não permitido.");
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + IDEMPOTENCY_DEFAULTS.TTL_HOURS * 3600 * 1000
    );

    // Caminho comum: primeira execução → cria registro em PROCESSING
    try {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          tenantId,
          scope: canonical,
          key,
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          expiresAt,
        },
        select: { id: true },
      });
      return { action: "PROCEED", recordId: created.id };
    } catch (e: any) {
      if (e?.code !== "P2002") throw e; // não é unique → propaga
    }

    // Já existe (mesma chave no mesmo tenant/escopo)
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { tenantId_scope_key: { tenantId, scope: canonical, key } },
    });

    if (!existing) {
      // Condição rara de visibilidade do índice → tenta criar novamente
      const created = await this.prisma.idempotencyKey.create({
        data: {
          tenantId,
          scope: canonical,
          key,
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          expiresAt,
        },
        select: { id: true },
      });
      return { action: "PROCEED", recordId: created.id };
    }

    // Expirado → reabre janela
    if (
      existing.expiresAt <= now ||
      existing.status === IdempotencyStatus.EXPIRED
    ) {
      const updated = await this.prisma.idempotencyKey.update({
        where: { id: existing.id },
        data: {
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          responseBody: Prisma.DbNull,
          responseCode: null,
          responseTruncated: false,
          errorCode: null,
          errorMessage: null,
          expiresAt,
        },
        select: { id: true },
      });
      return { action: "PROCEED", recordId: updated.id };
    }

    // SUCCEEDED → REPLAY (somente se payload idêntico)
    if (existing.status === IdempotencyStatus.SUCCEEDED) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException("IDEMPOTENCY_PAYLOAD_MISMATCH");
      }
      return {
        action: "REPLAY",
        responseCode: existing.responseCode ?? 200,
        responseBody: existing.responseBody ?? {},
      };
    }

    // FAILED → reprocessa (abre novamente)
    if (existing.status === IdempotencyStatus.FAILED) {
      const updated = await this.prisma.idempotencyKey.update({
        where: { id: existing.id },
        data: {
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          errorCode: null,
          errorMessage: null,
          expiresAt,
        },
        select: { id: true },
      });
      return { action: "PROCEED", recordId: updated.id };
    }

    // PROCESSING → o Interceptor retornará 429/Retry-After
    return { action: "IN_PROGRESS" };
  }

  /**
   * Marca SUCCEEDED com snapshot (até X bytes) + hints de recurso.
   * Se exceder o limite, grava um corpo mínimo com `truncated: true`.
   */
  public async succeed(
    recordId: string,
    responseCode: number,
    responseBody: any,
    options?: {
      resourceType?: string;
      resourceId?: string;
      truncateAtBytes?: number;
    }
  ) {
    const limit =
      options?.truncateAtBytes ?? IDEMPOTENCY_DEFAULTS.SNAPSHOT_MAX_BYTES;

    let bodyToStore: Prisma.InputJsonValue = (responseBody ??
      {}) as Prisma.InputJsonValue;
    let truncated = false;

    try {
      const raw = JSON.stringify(responseBody ?? {});
      const bytes = Buffer.byteLength(raw, "utf8");
      if (bytes > limit) {
        bodyToStore = {
          resourceId: options?.resourceId ?? null,
          truncated: true,
        } as Prisma.InputJsonValue;
        truncated = true;
      }
    } catch {
      // fallback: se não serializa, guarda payload mínimo
      bodyToStore = {
        resourceId: options?.resourceId ?? null,
        truncated: true,
      } as Prisma.InputJsonValue;
      truncated = true;
    }

    await this.prisma.idempotencyKey.update({
      where: { id: recordId },
      data: {
        status: IdempotencyStatus.SUCCEEDED,
        responseCode: responseCode ?? 200,
        responseBody: bodyToStore,
        responseTruncated: truncated,
        resourceType: options?.resourceType ?? null,
        resourceId: options?.resourceId ?? null,
      },
    });
  }

  /** Marca FAILED e persiste um erro curto (até 500 chars). */
  public async fail(
    recordId: string,
    errorCode: string,
    errorMessage?: string
  ) {
    try {
      await this.prisma.idempotencyKey.update({
        where: { id: recordId },
        data: {
          status: IdempotencyStatus.FAILED,
          errorCode,
          errorMessage: (errorMessage ?? "").slice(0, 500) || null,
        },
      });
    } catch {
      // noop
    }
  }
}
