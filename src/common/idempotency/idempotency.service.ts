import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
  | { action: "IN_PROGRESS"; retryAfter: number };

@Injectable()
export class IdempotencyService {
  private readonly log = new Logger("IdempotencyService");
  constructor(private readonly prisma: PrismaService) {}

  public readonly allowedScopes = IDEMPOTENCY_ALLOWED_SCOPES;

  /** ⚙️ Mapa de sinônimos → escopo CANÔNICO */
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

    // Payments (captura/estorno/cancelamento)
    "orders:payments:capture": "payments:capture",
    "payments:capture": "payments:capture",
    "payments:refund": "payments:refund",
    "payments:cancel": "payments:cancel",

    // Payments — INTENTS (NOVO)
    // Todos os aliases abaixo serão tratados como "payments:intent:create"
    "payments:intent:create": "payments:intent:create",
    "payments:intent:upsert": "payments:intent:create",
    "payment-intents:create": "payments:intent:create",
    "payment-intents:upsert": "payments:intent:create",

    // Webhooks
    "webhooks:create:endpoints": "webhooks:endpoints:create",
    "webhooks:endpoints:create": "webhooks:endpoints:create",
    "webhooks:replay": "webhooks:replay",

    // Inventory
    "inventory:create-item": "inventory:create-item",
    "inventory:items:create": "inventory:create-item",
    "inventory:update-item": "inventory:update-item",
    "inventory:items:update": "inventory:update-item",
    "inventory:adjust-item": "inventory:adjust-item",
    "inventory:items:adjust": "inventory:adjust-item",
    "inventory:upsert-recipe": "inventory:upsert-recipe",
    "inventory:recipes:upsert": "inventory:upsert-recipe",
  };

  public canonicalScope(input: string): string {
    const s = (input || "").trim();
    return this.scopeMap[s] || s;
  }

  /** Valida escopo/keys nos headers. */
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
    if (!IDEMPOTENCY_ALLOWED_SCOPES.has(canonicalHeader)) {
      throw new BadRequestException(
        "Escopo de idempotência não é suportado globalmente."
      );
    }
    if (!keyHeader) {
      throw new BadRequestException("Idempotency-Key é obrigatório.");
    }
  }

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

    // 1) Primeira execução → cria PROCESSING
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
      if (e?.code !== "P2002") throw e;
    }

    // 2) Já existe (tenantId+scope+key)
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { tenantId_scope_key: { tenantId, scope: canonical, key } },
    });

    if (!existing) {
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

    // Expirado (snapshot TTL) → reabre
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

    // SUCCEEDED → REPLAY (se payload idêntico)
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

    // FAILED → reprocessa
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

    // PROCESSING → checa STALE_TAKEOVER
    if (existing.status === IdempotencyStatus.PROCESSING) {
      const ageMs = now.getTime() - new Date(existing.updatedAt).getTime();
      const staleMs = IDEMPOTENCY_DEFAULTS.STALE_TAKEOVER_SECONDS * 1000;

      if (ageMs >= staleMs) {
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
          },
          select: { id: true },
        });
        this.log.warn(
          `STALE_TAKEOVER scope=${canonical} key=${key} tenant=${tenantId}`
        );
        return { action: "PROCEED", recordId: updated.id };
      }

      const retryAfter = Math.max(
        IDEMPOTENCY_DEFAULTS.RETRY_AFTER_SECONDS,
        Math.ceil((staleMs - ageMs) / 1000)
      );
      return { action: "IN_PROGRESS", retryAfter };
    }

    return {
      action: "IN_PROGRESS",
      retryAfter: IDEMPOTENCY_DEFAULTS.RETRY_AFTER_SECONDS,
    };
  }

  /** SUCCEEDED com snapshot (truncado se necessário). */
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

  /** FAILED com erro curto. */
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
