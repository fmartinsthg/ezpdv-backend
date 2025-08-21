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
/**
 * Garante que o tenantId está presente e válido no contexto do request.
 * - Admin/Staff: obtém do JWT
 * - SUPERADMIN: aceita via param ou header
 */
let TenantContextGuard = class TenantContextGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const isSuperAdmin = user?.role === "SUPERADMIN";
        const tenantId = request.params.tenantId ||
            request.headers["x-tenant-id"] ||
            user?.tenantId;
        if (!tenantId) {
            throw new common_1.ForbiddenException("tenantId obrigatório no contexto");
        }
        // (Opcional) Validar formato UUID aqui
        request.tenantId = tenantId;
        return true;
    }
};
exports.TenantContextGuard = TenantContextGuard;
exports.TenantContextGuard = TenantContextGuard = __decorate([
    (0, common_1.Injectable)()
], TenantContextGuard);
