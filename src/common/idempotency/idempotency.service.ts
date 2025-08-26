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

type BeginResult =
  | { action: "REPLAY"; responseCode: number; responseBody: any }
  | { action: "PROCEED"; recordId: string }
  | { action: "IN_PROGRESS" };

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  validateHeadersOrThrow(
    scopeFromRoute: string,
    scopeHeader?: string,
    keyHeader?: string
  ) {
    if (!scopeHeader) {
      throw new BadRequestException("Idempotency-Scope é obrigatório.");
    }
    if (scopeHeader !== scopeFromRoute) {
      throw new BadRequestException(
        "Idempotency-Scope inválido para este endpoint."
      );
    }
    if (!keyHeader) {
      throw new BadRequestException("Idempotency-Key é obrigatório.");
    }
  }

  async beginOrReplay(
    tenantId: string,
    scope: string,
    key: string,
    requestHash: string
  ): Promise<BeginResult> {
    if (!IDEMPOTENCY_ALLOWED_SCOPES.has(scope)) {
      throw new BadRequestException("Escopo de idempotência não permitido.");
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + IDEMPOTENCY_DEFAULTS.TTL_HOURS * 3600 * 1000
    );

    try {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          tenantId,
          scope,
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

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { tenantId_scope_key: { tenantId, scope, key } },
    });

    if (!existing) {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          tenantId,
          scope,
          key,
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          expiresAt,
        },
        select: { id: true },
      });
      return { action: "PROCEED", recordId: created.id };
    }

    if (
      existing.expiresAt <= now ||
      existing.status === IdempotencyStatus.EXPIRED
    ) {
      const updated = await this.prisma.idempotencyKey.update({
        where: { id: existing.id },
        data: {
          status: IdempotencyStatus.PROCESSING,
          requestHash,
          // ❗️Json? → use Prisma.DbNull para gravar NULL no BD
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

    return { action: "IN_PROGRESS" };
  }

  async succeed(
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
    const raw = JSON.stringify(responseBody ?? {});
    const bytes = Buffer.byteLength(raw, "utf8");

    // ❗️Para input de JSON use Prisma.InputJsonValue
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
