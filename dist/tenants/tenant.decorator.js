"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantId = void 0;
const common_1 = require("@nestjs/common");
/**
 * Extrai o tenantId do request (JWT, param ou header).
 * Uso: @TenantId() tenantId: string
 */
exports.TenantId = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    // Prioridade: param > header > JWT
    return (request.params.tenantId ||
        request.headers["x-tenant-id"] ||
        request.user?.tenantId ||
        null);
});
