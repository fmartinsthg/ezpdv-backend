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
const public_decorator_1 = require("../decorators/public.decorator");
const skip_tenant_decorator_1 = require("./skip-tenant.decorator");
let TenantContextGuard = class TenantContextGuard {
    constructor(reflector, jwtService, config) {
        this.reflector = reflector;
        this.jwtService = jwtService;
        this.config = config;
    }
    async canActivate(context) {
        // 1) Rotas públicas não exigem JWT/tenant
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        // 2) Rotas de PLATAFORMA (ex.: /tenants) não exigem tenant
        const skipTenant = this.reflector.getAllAndOverride(skip_tenant_decorator_1.SKIP_TENANT_KEY, [context.getHandler(), context.getClass()]);
        if (skipTenant)
            return true;
        const req = context.switchToHttp().getRequest();
        let user = (req.user || {});
        // 3) Fallback: se req.user não vier populado pelo JwtAuthGuard, verifique o JWT manualmente
        if (!user?.sub) {
            const authHeader = (req.headers['authorization'] || '');
            const hasBearer = authHeader.startsWith('Bearer ');
            if (!hasBearer) {
                throw new common_1.ForbiddenException('Usuário não autenticado.');
            }
            const token = authHeader.slice('Bearer '.length).trim();
            try {
                // Verifica assinatura e expiração (mais seguro que decode)
                const secret = this.config.get('JWT_SECRET') ||
                    this.config.get('AUTH_JWT_SECRET'); // caso seu projeto use outra chave
                const payload = await this.jwtService.verifyAsync(token, {
                    secret,
                });
                user = payload;
                req.user = user; // popula o request para os próximos guards/controllers
            }
            catch {
                throw new common_1.ForbiddenException('Usuário não autenticado.');
            }
        }
        // 4) Papel efetivo: plataforma > tenant
        const effectiveRole = String(user.systemRole ?? user.role ?? '')
            .toUpperCase()
            .trim();
        // 5) SUPERADMIN → exige header X-Tenant-Id em rotas multi-tenant
        if (effectiveRole === 'SUPERADMIN') {
            const headerValue = req.headers[tenant_constants_1.TENANT_HEADER] ||
                req.headers[String(tenant_constants_1.TENANT_HEADER).toUpperCase()];
            if (!headerValue) {
                throw new common_1.BadRequestException(tenant_constants_1.TenantErrors.MISSING_HEADER_FOR_SUPERADMIN);
            }
            req.tenantId = headerValue;
            return true;
        }
        // 6) Demais papéis → tenant do token
        if (!user.tenantId) {
            throw new common_1.ForbiddenException(tenant_constants_1.TenantErrors.MISSING_TENANT_IN_TOKEN);
        }
        req.tenantId = user.tenantId;
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
