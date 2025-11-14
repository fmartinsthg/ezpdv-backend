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
var IdempotencyInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyInterceptor = void 0;
// src/common/idempotency/idempotency.interceptor.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const idempotency_service_1 = require("./idempotency.service");
const idempotency_decorator_1 = require("./idempotency.decorator");
const idempotency_constants_1 = require("./idempotency.constants");
const idempotency_util_1 = require("./idempotency.util");
const REENTRANT_FLAG = Symbol("IDEMPOTENCY_INTERCEPTOR_VISITED");
let IdempotencyInterceptor = IdempotencyInterceptor_1 = class IdempotencyInterceptor {
    constructor(reflector, service) {
        this.reflector = reflector;
        this.service = service;
        this.logger = new common_1.Logger(IdempotencyInterceptor_1.name);
    }
    intercept(context, next) {
        const raw = this.reflector.get(idempotency_decorator_1.IDEMPOTENCY_SCOPE_META, context.getHandler());
        // Rota não idempotente
        if (!raw)
            return next.handle();
        const allowed = Array.isArray(raw) ? raw : [raw];
        const isForbidden = allowed.length === 1 && allowed[0] === idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN;
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        // --- Proteção reentrante por request ---
        if (req[REENTRANT_FLAG]) {
            // Interceptor já executou nesta mesma request
            return next.handle();
        }
        req[REENTRANT_FLAG] = true;
        // ---------------------------------------
        if (isForbidden) {
            const hasIdemHeaders = !!req.headers[idempotency_constants_1.IDEMPOTENCY_HEADERS.KEY] ||
                !!req.headers[idempotency_constants_1.IDEMPOTENCY_HEADERS.SCOPE];
            if (hasIdemHeaders) {
                throw new common_1.BadRequestException("Escopo de idempotência não permitido para este endpoint.");
            }
            return next.handle();
        }
        const tenantId = req.tenantId;
        const scopeHeader = String(req.headers[idempotency_constants_1.IDEMPOTENCY_HEADERS.SCOPE] || "");
        const keyHeader = String(req.headers[idempotency_constants_1.IDEMPOTENCY_HEADERS.KEY] || "");
        if (!tenantId) {
            throw new common_1.BadRequestException("tenantId ausente no contexto.");
        }
        // Validação headers
        this.service.validateHeadersOrThrow(allowed, scopeHeader, keyHeader);
        if (!(0, idempotency_util_1.isUuidV4)(keyHeader)) {
            throw new common_1.BadRequestException("Idempotency-Key deve ser UUID v4.");
        }
        // Hash determinístico do body
        const bodyString = (0, idempotency_util_1.canonicalJsonStringify)(req.body ?? {});
        const requestHash = (0, idempotency_util_1.sha256Hex)(bodyString);
        const effectiveScope = this.service.canonicalScope(scopeHeader);
        return new rxjs_1.Observable((subscriber) => {
            (async () => {
                try {
                    const begin = await this.service.beginOrReplay(tenantId, effectiveScope, keyHeader, requestHash);
                    // Ecoa cabeçalhos p/ debug
                    res.setHeader("Idempotency-Key", keyHeader);
                    res.setHeader("Idempotency-Scope", scopeHeader);
                    if (begin.action === "REPLAY") {
                        res.setHeader(idempotency_constants_1.IDEMPOTENCY_HEADERS.REPLAYED, "true");
                        res.status(begin.responseCode || common_1.HttpStatus.OK);
                        subscriber.next(begin.responseBody ?? {});
                        subscriber.complete();
                        return;
                    }
                    if (begin.action === "IN_PROGRESS") {
                        // Duplicidade real (concorrência externa) ou reentrância evitada
                        this.logger.warn(`IN_PROGRESS tenant=${tenantId} scope=${effectiveScope} key=${keyHeader}`);
                        res.setHeader("Retry-After", String(idempotency_constants_1.IDEMPOTENCY_DEFAULTS.RETRY_AFTER_SECONDS));
                        throw new common_1.HttpException("IDEMPOTENCY_IN_PROGRESS", common_1.HttpStatus.TOO_MANY_REQUESTS);
                    }
                    // PROCEED → injeta contexto idempotente
                    req.idempotency = {
                        key: keyHeader,
                        scope: effectiveScope,
                        requestHash,
                        recordId: begin.recordId,
                    };
                    res.setHeader(idempotency_constants_1.IDEMPOTENCY_HEADERS.REPLAYED, "false");
                    next
                        .handle()
                        .pipe((0, operators_1.tap)(async (data) => {
                        // Snapshot + hints (orderId etc.)
                        const resource = this.extractResource(effectiveScope, data);
                        await this.service.succeed(begin.recordId, res.statusCode || common_1.HttpStatus.OK, data, resource);
                    }), (0, operators_1.catchError)((err) => {
                        const code = (err?.status ??
                            err?.response?.status ??
                            err?.code ??
                            "UNEXPECTED_ERROR") + "";
                        const msg = (err?.message ??
                            err?.response?.message ??
                            (typeof err?.response === "string" ? err.response : "")) +
                            "";
                        this.service
                            .fail(begin.recordId, code.slice(0, 60), msg.slice(0, 500))
                            .catch(() => { });
                        throw err;
                    }))
                        .subscribe({
                        next: (v) => subscriber.next(v),
                        error: (e) => subscriber.error(e),
                        complete: () => subscriber.complete(),
                    });
                }
                catch (e) {
                    subscriber.error(e);
                }
            })();
        });
    }
    extractResource(scope, body) {
        if (!body || typeof body !== "object")
            return {};
        if (scope.startsWith("orders:")) {
            const id = body.id ?? body.orderId;
            if (typeof id === "string")
                return { resourceType: "order", resourceId: id };
        }
        if (scope.startsWith("payments:")) {
            const oid = body?.orderId ?? body?.order?.id ?? body?.summary?.orderId ?? undefined;
            if (typeof oid === "string")
                return { resourceType: "order", resourceId: oid };
        }
        return {};
    }
};
exports.IdempotencyInterceptor = IdempotencyInterceptor;
exports.IdempotencyInterceptor = IdempotencyInterceptor = IdempotencyInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        idempotency_service_1.IdempotencyService])
], IdempotencyInterceptor);
