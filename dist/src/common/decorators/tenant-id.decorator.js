"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantId = void 0;
const common_1 = require("@nestjs/common");
/**
 * @TenantId()
 * Prioriza o valor definido pelo TenantContextGuard (req.tenantId).
 * Fallback: param de rota :tenantId ou header X-Tenant-Id.
 * Mantém o contrato multi-tenant mesmo se o guard não populou o request.
 */
exports.TenantId = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    const fromGuard = req.tenantId;
    const fromParam = req.params?.tenantId;
    const fromHeader = req.headers?.['x-tenant-id'];
    const tenantId = fromGuard ?? fromParam ?? fromHeader;
    if (!tenantId || typeof tenantId !== 'string') {
        throw new common_1.BadRequestException('TenantId is required (missing in context, route param, or X-Tenant-Id header)');
    }
    return tenantId;
});
