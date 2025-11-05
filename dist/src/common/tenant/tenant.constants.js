"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantErrors = exports.TENANT_HEADER = void 0;
exports.TENANT_HEADER = 'x-tenant-id';
class TenantErrors {
}
exports.TenantErrors = TenantErrors;
TenantErrors.MISSING_HEADER_FOR_SUPERADMIN = 'SUPERADMIN deve informar o header X-Tenant-Id para operar sobre um tenant específico.';
TenantErrors.MISSING_TENANT_IN_TOKEN = 'Usuário não possui tenant associado no token.';
TenantErrors.PATH_TENANT_MISMATCH = 'O tenant da rota não corresponde ao tenant do contexto.';
