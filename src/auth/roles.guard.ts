import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

type AuthUserLike = {
  role?: string | null;        // papel no tenant (ADMIN/MODERATOR/USER)
  systemRole?: string | null;  // papel de plataforma (SUPERADMIN)
  roles?: string[] | null;     // opcional: lista agregada
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Rotas públicas não exigem papel
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = (req?.user || {}) as AuthUserLike;

    // Colete papéis potenciais do token (plataforma + tenant + array)
    const tokenRoles = new Set<string>();

    if (user.role) tokenRoles.add(String(user.role).toUpperCase());
    if (user.systemRole) tokenRoles.add(String(user.systemRole).toUpperCase());
    if (Array.isArray(user.roles)) {
      for (const r of user.roles) {
        if (r) tokenRoles.add(String(r).toUpperCase());
      }
    }

    if (tokenRoles.size === 0) return false;

    // SUPERADMIN como superuser: tem passe livre em qualquer rota
    if (tokenRoles.has('SUPERADMIN')) return true;

    // Caso-insensível
    return requiredRoles.some((r) => tokenRoles.has(String(r).toUpperCase()));
  }
}