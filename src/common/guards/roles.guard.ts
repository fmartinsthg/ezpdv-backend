import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

type SystemRole = 'SUPERADMIN' | 'SUPPORT' | 'NONE';

interface AuthUser {
  // do payload montado no JwtStrategy
  userId: string;
  systemRole?: SystemRole | null;  // papel global
  tenantId?: string | null;        // resolvido pelo middleware
  role?: TenantRole | null;        // papel no tenant atual
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Ex.: @Roles('ADMIN','MODERATOR')
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Se a rota não exigiu roles, permite
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;

    if (!user) return false;

    // SUPERADMIN tem passe livre (desde que o tenant middleware
    // já tenha resolvido X-Tenant-Id quando necessário)
    if (user.systemRole === 'SUPERADMIN') return true;

    // Se não tem role de tenant, nega
    if (!user.role) return false;

    // Normaliza os roles exigidos (strings) para o enum do Prisma
    const requiredEnumRoles = required.map(
      r => r.toUpperCase() as keyof typeof TenantRole
    );

    return requiredEnumRoles.includes(user.role);
  }
}