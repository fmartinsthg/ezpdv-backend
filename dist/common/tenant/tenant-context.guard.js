"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContextGuard = void 0;
const common_1 = require("@nestjs/common");
const tenant_constants_1 = require("./tenant.constants");
let TenantContextGuard = class TenantContextGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const user = (req.user || {});
        if (!user || !user.role) {
            // JwtAuthGuard deve ter rodado antes
            throw new common_1.ForbiddenException('Usuário não autenticado.');
        }
        let resolvedTenantId;
        if (user.role === 'SUPERADMIN') {
            // SUPERADMIN escolhe o tenant via header
            const headerValue = req.headers[tenant_constants_1.TENANT_HEADER] ||
                req.headers[tenant_constants_1.TENANT_HEADER.toUpperCase()];
            if (!headerValue) {
                throw new common_1.BadRequestException(tenant_constants_1.TenantErrors.MISSING_HEADER_FOR_SUPERADMIN);
            }
            resolvedTenantId = headerValue;
        }
        else {
            // Demais roles usam o tenant do token
            if (!user.tenantId) {
                throw new common_1.ForbiddenException(tenant_constants_1.TenantErrors.MISSING_TENANT_IN_TOKEN);
            }
            resolvedTenantId = user.tenantId;
        }
        // Anexa ao request para Decorators/Services
        req.tenantId = resolvedTenantId;
        return true;
    }
};
exports.TenantContextGuard = TenantContextGuard;
exports.TenantContextGuard = TenantContextGuard = __decorate([
    (0, common_1.Injectable)()
], TenantContextGuard);
