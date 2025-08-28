import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, IdempotencyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IDEMPOTENCY_ALLOWED_SCOPES,
  IDEMPOTENCY_DEFAULTS,
} from './idempotency.constants';

type BeginResult =
  | { action: 'REPLAY'; responseCode: number; responseBody: any }
  | { action: 'PROCEED'; recordId: string }
  | { action: 'IN_PROGRESS' };

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mapa de sinônimos → escopo CANÔNICO */
  private scopeMap: Record<string, string> = {
    // Orders
    'orders:append-items': 'orders:append-items',
    'orders:items:append': 'orders:append-items',
    'orders:void-item': 'orders:void-item',
    'orders:items:void': 'orders:void-item',
    'orders:fire': 'orders:fire',
    'orders:cancel': 'orders:cancel',
    'orders:close': 'orders:close',
    'orders:create': 'orders:create',
    // Payments
    'payments:capture': 'payments:capture',
    'payments:refund': 'payments:refund',
    'payments:cancel': 'payments:cancel',
  };

  /** Retorna a forma canônica do escopo (ou o próprio se não houver mapeamento) */
  public canonicalScope(input: string): string {
    const s = (input || '').trim();
    return this.scopeMap[s] || s;
  }

  /**
   * Valida headers de idempotência:
   *  - scopeHeader presente e pertencente ao conjunto de escopos permitidos para o handler (considerando sinônimos);
   *  - keyHeader presente.
   * Lança 400 se inválido.
   */
  validateHeadersOrThrow(
    allowedFromHandler: string[] | string,
    scopeHeader?: string,
    keyHeader?: string,
  ) {
    const allowed = Array.isArray(allowedFromHandler)
      ? allowedFromHandler
      : [allowedFromHandler];

    if (!scopeHeader) {
      throw new BadRequestException('Idempotency-Scope é obrigatório.');
    }
    const canonicalHeader = this.canonicalScope(scopeHeader);
    const canonicalAllowed = new Set(allowed.map((s) => this.canonicalScope(s)));

    if (!canonicalAllowed.has(canonicalHeader)) {
      throw new BadRequestException('Escopo de idempotência não permitido.');
    }
    if (!keyHeader) {
      throw new BadRequestException('Idempotency-Key é obrigatório.');
    }
  }

  async beginOrReplay(
    tenantId: string,
    scope: string,         // pode vir em qualquer forma; será canônico abaixo
    key: string,
    requestHash: string,
  ): Promise<BeginResult> {
    // Canoniza e valida contra set global
    const canonical = this.canonicalScope(scope);
    if (!IDEMPOTENCY_ALLOWED_SCOPES.has(canonical)) {
      throw new BadRequestException('Escopo de idempotência não permitido.');
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + IDEMPOTENCY_DEFAULTS.TTL_HOURS * 3600 * 1000,
    );

    // Tenta criar o registro (caminho comum: primeira execução)
    try {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          tenantId,
          scope: canonical, // sempre persistir canônico
          key,
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          expiresAt,
        },
        select: { id: true },
      });
      return { action: 'PROCEED', recordId: created.id };
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // não é conflito de unique → propaga
    }

    // Já existe (mesma (tenant, scope, key))
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { tenantId_scope_key: { tenantId, scope: canonical, key } },
    });

    if (!existing) {
      // Janela rara: índice ainda não refletiu? Tenta criar novamente
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
      return { action: 'PROCEED', recordId: created.id };
    }

    // Expirado → reabre janela
    if (existing.expiresAt <= now || existing.status === IdempotencyStatus.EXPIRED) {
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
      return { action: 'PROCEED', recordId: updated.id };
    }

    // Succeeded → REPLAY (exige payload igual)
    if (existing.status === IdempotencyStatus.SUCCEEDED) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      return {
        action: 'REPLAY',
        responseCode: existing.responseCode ?? 200,
        responseBody: existing.responseBody ?? {},
      };
    }

    // Failed → reprocessa
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
      return { action: 'PROCEED', recordId: updated.id };
    }

    // PROCESSING → 429 (emitted pelo interceptor)
    return { action: 'IN_PROGRESS' };
  }

  async succeed(
    recordId: string,
    responseCode: number,
    responseBody: any,
    options?: {
      resourceType?: string;
      resourceId?: string;
      truncateAtBytes?: number;
    },
  ) {
    const limit =
      options?.truncateAtBytes ?? IDEMPOTENCY_DEFAULTS.SNAPSHOT_MAX_BYTES;
    const raw = JSON.stringify(responseBody ?? {});
    const bytes = Buffer.byteLength(raw, 'utf8');

    let bodyToStore: Prisma.InputJsonValue = (responseBody ??
      {}) as Prisma.InputJsonValue;
    let truncated = false;

    if (bytes > limit) {
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
        responseCode,
        responseBody: bodyToStore,
        responseTruncated: truncated,
        resourceType: options?.resourceType ?? null,
        resourceId: options?.resourceId ?? null,
      },
    });
  }

  async fail(recordId: string, errorCode: string, errorMessage?: string) {
    try {
      await this.prisma.idempotencyKey.update({
        where: { id: recordId },
        data: {
          status: IdempotencyStatus.FAILED,
          errorCode,
          errorMessage: errorMessage?.slice(0, 500) ?? null,
        },
      });
    } catch {
      // noop
    }
  }
}
