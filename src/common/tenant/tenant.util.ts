import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../../auth/jwt.strategy';

export function resolveEffectiveTenantId(user: AuthUser, xTenantId?: string): string {
  if (user.systemRole === 'SUPERADMIN') {
    const id = xTenantId?.trim();
    if (!id) throw new BadRequestException('SUPERADMIN precisa informar X-Tenant-Id.');
    return id;
  }
  if (!user.tenantId) throw new ForbiddenException('Usuário sem tenant associado.');
  return user.tenantId;
}