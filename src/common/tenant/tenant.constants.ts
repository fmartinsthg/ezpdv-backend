export const TENANT_HEADER = 'x-tenant-id' as const;

export class TenantErrors {
  static MISSING_HEADER_FOR_SUPERADMIN =
    'SUPERADMIN deve informar o header X-Tenant-Id para operar sobre um tenant específico.';
  static MISSING_TENANT_IN_TOKEN =
    'Usuário não possui tenant associado no token.';
  static PATH_TENANT_MISMATCH =
    'O tenant da rota não corresponde ao tenant do contexto.';
}