"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canCloseOrReopen = canCloseOrReopen;
const client_1 = require("@prisma/client");
function canCloseOrReopen(system, tenant) {
    if (system === client_1.SystemRole.SUPERADMIN)
        return true;
    return tenant === client_1.TenantRole.ADMIN || tenant === client_1.TenantRole.MODERATOR;
}
