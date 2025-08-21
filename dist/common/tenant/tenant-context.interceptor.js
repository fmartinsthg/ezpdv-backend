"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantRouteValidationInterceptor = void 0;
const common_1 = require("@nestjs/common");
const tenant_constants_1 = require("./tenant.constants");
let TenantRouteValidationInterceptor = class TenantRouteValidationInterceptor {
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const user = (req.user || {});
        const routeTenantId = req.params?.tenantId;
        const ctxTenantId = req.tenantId;
        // Se a rota tiver :tenantId, validamos contra o tenant do contexto
        if (routeTenantId) {
            // Para SUPERADMIN, aceitamos :tenantId desde que seja igual ao escolhido via header
            // Para demais roles, deve sempre bater com o tenant do token
            if (!ctxTenantId || routeTenantId !== ctxTenantId) {
                throw new common_1.ForbiddenException(tenant_constants_1.TenantErrors.PATH_TENANT_MISMATCH);
            }
        }
        return next.handle();
    }
};
exports.TenantRouteValidationInterceptor = TenantRouteValidationInterceptor;
exports.TenantRouteValidationInterceptor = TenantRouteValidationInterceptor = __decorate([
    (0, common_1.Injectable)()
], TenantRouteValidationInterceptor);
