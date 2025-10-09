import { SystemRole, TenantRole } from "@prisma/client";

export function canCloseOrReopen(system: SystemRole, tenant: TenantRole) {
  if (system === SystemRole.SUPERADMIN) return true;
  return tenant === TenantRole.ADMIN || tenant === TenantRole.MODERATOR;
}
