"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffectiveTenantId = resolveEffectiveTenantId;
const common_1 = require("@nestjs/common");
function resolveEffectiveTenantId(user, xTenantId) {
    if (user.systemRole === 'SUPERADMIN') {
        const id = xTenantId?.trim();
        if (!id)
            throw new common_1.BadRequestException('SUPERADMIN precisa informar X-Tenant-Id.');
        return id;
    }
    if (!user.tenantId)
        throw new common_1.ForbiddenException('Usuário sem tenant associado.');
    return user.tenantId;
}
