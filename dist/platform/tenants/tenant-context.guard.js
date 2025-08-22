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
const tenant_constants_1 = require("../../common/tenant/tenant.constants");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const skip_tenant_decorator_1 = require("../../common/tenant/skip-tenant.decorator");
let TenantContextGuard = class TenantContextGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
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
        const user = (req.user || {});
        // 3) JWT precisa existir em rotas não públicas
        if (!user?.sub) {
            throw new common_1.ForbiddenException('Usuário não autenticado.');
        }
        // 4) Normaliza papel efetivo: plataforma > tenant
        const effectiveRole = String((user.systemRole ?? user.role ?? '').toString()).toUpperCase();
        // 5) SUPERADMIN → precisa informar o tenant alvo via header X-Tenant-Id
        if (effectiveRole === 'SUPERADMIN') {
            const headerValue = req.headers[tenant_constants_1.TENANT_HEADER] ||
                req.headers[String(tenant_constants_1.TENANT_HEADER).toUpperCase()];
            if (!headerValue) {
                throw new common_1.BadRequestException(tenant_constants_1.TenantErrors.MISSING_HEADER_FOR_SUPERADMIN);
            }
            req.tenantId = headerValue;
            return true;
        }
        // 6) Demais papéis → tenant vem do token
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
    __metadata("design:paramtypes", [core_1.Reflector])
], TenantContextGuard);
