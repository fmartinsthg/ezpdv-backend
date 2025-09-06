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
        /** Exposto para debug/telemetria se necessário */
        this.allowedScopes = idempotency_constants_1.IDEMPOTENCY_ALLOWED_SCOPES;
        /** Mapa de sinônimos → escopo CANÔNICO */
        this.scopeMap = {
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
    }
    /** Retorna a forma canônica do escopo (ou o próprio se não houver mapeamento). */
    canonicalScope(input) {
        const s = (input || "").trim();
        return this.scopeMap[s] || s;
    }
    /**
     * Valida headers de idempotência:
     *  - scopeHeader presente e pertencente ao conjunto permitido no handler (com sinônimos);
     *  - keyHeader presente.
     *  - (opcional) verifica também contra a allowlist global (defensivo).
     */
    validateHeadersOrThrow(allowedFromHandler, scopeHeader, keyHeader) {
        const allowed = Array.isArray(allowedFromHandler)
            ? allowedFromHandler
            : [allowedFromHandler];
        if (!scopeHeader) {
            throw new common_1.BadRequestException("Idempotency-Scope é obrigatório.");
        }
        const canonicalHeader = this.canonicalScope(scopeHeader);
        const canonicalAllowed = new Set(allowed.map((s) => this.canonicalScope(s)));
        if (!canonicalAllowed.has(canonicalHeader)) {
            throw new common_1.BadRequestException("Escopo de idempotência não permitido para este endpoint.");
        }
        // Checagem extra contra allowlist global (hardening)
        if (!idempotency_constants_1.IDEMPOTENCY_ALLOWED_SCOPES.has(canonicalHeader)) {
            throw new common_1.BadRequestException("Escopo de idempotência não é suportado globalmente.");
        }
        if (!keyHeader) {
            throw new common_1.BadRequestException("Idempotency-Key é obrigatório.");
        }
    }
    /**
     * Registra a chave (primeira vez) ou detecta condições de REPLAY/IN_PROGRESS/RETRY.
     * Sempre persiste escopo **canônico**.
     */
    async beginOrReplay(tenantId, scope, key, requestHash) {
        const canonical = this.canonicalScope(scope);
        if (!idempotency_constants_1.IDEMPOTENCY_ALLOWED_SCOPES.has(canonical)) {
            throw new common_1.BadRequestException("Escopo de idempotência não permitido.");
        }
        const now = new Date();
        const expiresAt = new Date(now.getTime() + idempotency_constants_1.IDEMPOTENCY_DEFAULTS.TTL_HOURS * 3600 * 1000);
        // Caminho comum: primeira execução → cria registro em PROCESSING
        try {
            const created = await this.prisma.idempotencyKey.create({
                data: {
                    tenantId,
                    scope: canonical,
                    key,
                    status: client_1.IdempotencyStatus.PROCESSING,
                    requestHash,
                    expiresAt,
                },
                select: { id: true },
            });
            return { action: "PROCEED", recordId: created.id };
        }
        catch (e) {
            if (e?.code !== "P2002")
                throw e; // não é unique → propaga
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
                    status: client_1.IdempotencyStatus.PROCESSING,
                    requestHash,
                    expiresAt,
                },
                select: { id: true },
            });
            return { action: "PROCEED", recordId: created.id };
        }
        // Expirado → reabre janela
        if (existing.expiresAt <= now ||
            existing.status === client_1.IdempotencyStatus.EXPIRED) {
            const updated = await this.prisma.idempotencyKey.update({
                where: { id: existing.id },
                data: {
                    status: client_1.IdempotencyStatus.PROCESSING,
                    requestHash,
                    responseBody: client_1.Prisma.DbNull,
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
        if (existing.status === client_1.IdempotencyStatus.SUCCEEDED) {
            if (existing.requestHash !== requestHash) {
                throw new common_1.ConflictException("IDEMPOTENCY_PAYLOAD_MISMATCH");
            }
            return {
                action: "REPLAY",
                responseCode: existing.responseCode ?? 200,
                responseBody: existing.responseBody ?? {},
            };
        }
        // FAILED → reprocessa (abre novamente)
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
            return { action: "PROCEED", recordId: updated.id };
        }
        // PROCESSING → o Interceptor retornará 429/Retry-After
        return { action: "IN_PROGRESS" };
    }
    /**
     * Marca SUCCEEDED com snapshot (até X bytes) + hints de recurso.
     * Se exceder o limite, grava um corpo mínimo com `truncated: true`.
     */
    async succeed(recordId, responseCode, responseBody, options) {
        const limit = options?.truncateAtBytes ?? idempotency_constants_1.IDEMPOTENCY_DEFAULTS.SNAPSHOT_MAX_BYTES;
        let bodyToStore = (responseBody ??
            {});
        let truncated = false;
        try {
            const raw = JSON.stringify(responseBody ?? {});
            const bytes = Buffer.byteLength(raw, "utf8");
            if (bytes > limit) {
                bodyToStore = {
                    resourceId: options?.resourceId ?? null,
                    truncated: true,
                };
                truncated = true;
            }
        }
        catch {
            // fallback: se não serializa, guarda payload mínimo
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
                responseCode: responseCode ?? 200,
                responseBody: bodyToStore,
                responseTruncated: truncated,
                resourceType: options?.resourceType ?? null,
                resourceId: options?.resourceId ?? null,
            },
        });
    }
    /** Marca FAILED e persiste um erro curto (até 500 chars). */
    async fail(recordId, errorCode, errorMessage) {
        try {
            await this.prisma.idempotencyKey.update({
                where: { id: recordId },
                data: {
                    status: client_1.IdempotencyStatus.FAILED,
                    errorCode,
                    errorMessage: (errorMessage ?? "").slice(0, 500) || null,
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
