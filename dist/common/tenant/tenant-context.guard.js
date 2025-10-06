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
exports.TenantContextGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const tenant_constants_1 = require("./tenant.constants");
const public_decorator_1 = require("../decorators/public.decorator"); // <— MESMO arquivo
const skip_tenant_decorator_1 = require("./skip-tenant.decorator");
let TenantContextGuard = class TenantContextGuard {
    constructor(reflector, jwtService, config) {
        this.reflector = reflector;
        this.jwtService = jwtService;
        this.config = config;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        // 0) Bypass defensivo por URL (funciona mesmo com prefixo /api, /v1, etc.)
        const url = String(req.originalUrl || req.url || "").toLowerCase();
        if (url.includes("/auth/login")) {
            return true;
        }
        // 1) Rotas públicas não exigem JWT/tenant
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        // 2) Rotas que explicitamente “pulam” tenant (plataforma)
        const skipTenant = this.reflector.getAllAndOverride(skip_tenant_decorator_1.SKIP_TENANT_KEY, [context.getHandler(), context.getClass()]);
        if (skipTenant)
            return true;
        let user = (req.user || {});
        // 3) Garante user no request (fallback se JwtAuthGuard ainda não populou)
        if (!user?.sub) {
            const authHeader = (req.headers["authorization"] || "");
            const hasBearer = authHeader.startsWith("Bearer ");
            if (!hasBearer) {
                throw new common_1.ForbiddenException("Usuário não autenticado.");
            }
            const token = authHeader.slice("Bearer ".length).trim();
            try {
                const secret = this.config.get("JWT_SECRET") ||
                    this.config.get("AUTH_JWT_SECRET");
                const payload = await this.jwtService.verifyAsync(token, { secret });
                user = payload;
                req.user = user;
            }
            catch {
                throw new common_1.ForbiddenException("Usuário não autenticado.");
            }
        }
        // 4) Papel efetivo
        const effectiveRole = String(user.systemRole ?? user.role ?? "")
            .toUpperCase()
            .trim();
        // 5) Descobre tenant: param OU header (aceita os dois)
        const candidateTenantId = (req.params &&
            typeof req.params.tenantId === "string" &&
            req.params.tenantId) ||
            req.headers[tenant_constants_1.TENANT_HEADER] ||
            req.headers[String(tenant_constants_1.TENANT_HEADER).toUpperCase()] ||
            undefined;
        // 6) SUPERADMIN → requer tenant explícito (param ou header)
        if (effectiveRole === "SUPERADMIN") {
            if (!candidateTenantId) {
                throw new common_1.BadRequestException(tenant_constants_1.TenantErrors.MISSING_HEADER_FOR_SUPERADMIN);
            }
            if (typeof candidateTenantId !== "string" ||
                candidateTenantId.length < 10) {
                throw new common_1.BadRequestException("X-Tenant-Id inválido.");
            }
            req.tenantId = candidateTenantId;
            return true;
        }
        // 7) Demais papéis → tenant do token (e valida coincidência se veio na rota)
        const tokenTenant = user.tenantId;
        if (!tokenTenant) {
            throw new common_1.ForbiddenException(tenant_constants_1.TenantErrors.MISSING_TENANT_IN_TOKEN);
        }
        if (candidateTenantId && candidateTenantId !== tokenTenant) {
            throw new common_1.ForbiddenException("Tenant da rota/headers diverge do tenant do token.");
        }
        req.tenantId = tokenTenant;
        return true;
    }
};
exports.TenantContextGuard = TenantContextGuard;
exports.TenantContextGuard = TenantContextGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        jwt_1.JwtService,
        config_1.ConfigService])
], TenantContextGuard);
