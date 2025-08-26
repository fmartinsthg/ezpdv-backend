"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const idempotency_constants_1 = require("./idempotency.constants");
let IdempotencyService = class IdempotencyService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    validateHeadersOrThrow(scopeFromRoute, scopeHeader, keyHeader) {
        if (!scopeHeader) {
            throw new common_1.BadRequestException('Idempotency-Scope é obrigatório.');
        }
        if (scopeHeader !== scopeFromRoute) {
            throw new common_1.BadRequestException('Idempotency-Scope inválido para este endpoint.');
        }
        if (!keyHeader) {
            throw new common_1.BadRequestException('Idempotency-Key é obrigatório.');
        }
    }
    async beginOrReplay(tenantId, scope, key, requestHash) {
        if (!idempotency_constants_1.IDEMPOTENCY_ALLOWED_SCOPES.has(scope)) {
            throw new common_1.BadRequestException('Escopo de idempotência não permitido.');
        }
        const now = new Date();
        const expiresAt = new Date(now.getTime() + idempotency_constants_1.IDEMPOTENCY_DEFAULTS.TTL_HOURS * 3600 * 1000);
        try {
            const created = await this.prisma.idempotencyKey.create({
                data: {
                    tenantId,
                    scope,
                    key,
                    status: client_1.IdempotencyStatus.PROCESSING,
                    requestHash,
                    expiresAt,
                },
                select: { id: true },
            });
            return { action: 'PROCEED', recordId: created.id };
        }
        catch (e) {
            if (e?.code !== 'P2002')
                throw e;
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
                    status: client_1.IdempotencyStatus.PROCESSING,
                    requestHash,
                    expiresAt,
                },
                select: { id: true },
            });
            return { action: 'PROCEED', recordId: created.id };
        }
        if (existing.expiresAt <= now || existing.status === client_1.IdempotencyStatus.EXPIRED) {
            const updated = await this.prisma.idempotencyKey.update({
                where: { id: existing.id },
                data: {
                    status: client_1.IdempotencyStatus.PROCESSING,
                    requestHash,
                    // ❗️Json? → use Prisma.DbNull para gravar NULL no BD
                    responseBody: client_1.Prisma.DbNull,
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
        if (existing.status === client_1.IdempotencyStatus.SUCCEEDED) {
            if (existing.requestHash !== requestHash) {
                throw new common_1.ConflictException('IDEMPOTENCY_PAYLOAD_MISMATCH');
            }
            return {
                action: 'REPLAY',
                responseCode: existing.responseCode ?? 200,
                responseBody: existing.responseBody ?? {},
            };
        }
        if (existing.status === client_1.IdempotencyStatus.FAILED) {
            const updated = await this.prisma.idempotencyKey.update({
                where: { id: existing.id },
                data: {
                    status: client_1.IdempotencyStatus.PROCESSING,
                    requestHash,
                    errorCode: null,
                    errorMessage: null,
                    expiresAt,
                },
                select: { id: true },
            });
            return { action: 'PROCEED', recordId: updated.id };
        }
        return { action: 'IN_PROGRESS' };
    }
    async succeed(recordId, responseCode, responseBody, options) {
        const limit = options?.truncateAtBytes ?? idempotency_constants_1.IDEMPOTENCY_DEFAULTS.SNAPSHOT_MAX_BYTES;
        const raw = JSON.stringify(responseBody ?? {});
        const bytes = Buffer.byteLength(raw, 'utf8');
        // ❗️Para input de JSON use Prisma.InputJsonValue
        let bodyToStore = (responseBody ?? {});
        let truncated = false;
        if (bytes > limit) {
            bodyToStore = {
                resourceId: options?.resourceId ?? null,
                truncated: true,
            };
            truncated = true;
        }
        await this.prisma.idempotencyKey.update({
            where: { id: recordId },
            data: {
                status: client_1.IdempotencyStatus.SUCCEEDED,
                responseCode,
                responseBody: bodyToStore,
                responseTruncated: truncated,
                resourceType: options?.resourceType ?? null,
                resourceId: options?.resourceId ?? null,
            },
        });
    }
    async fail(recordId, errorCode, errorMessage) {
        try {
            await this.prisma.idempotencyKey.update({
                where: { id: recordId },
                data: {
                    status: client_1.IdempotencyStatus.FAILED,
                    errorCode,
                    errorMessage: errorMessage?.slice(0, 500) ?? null,
                },
            });
        }
        catch {
            // noop
        }
    }
};
exports.IdempotencyService = IdempotencyService;
exports.IdempotencyService = IdempotencyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IdempotencyService);
