import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

type AuthUserLike = {
  role?: string | null;
  systemRole?: string | null;
  roles?: string[] | null;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    const tokenRoles = new Set<string>();
    if (user.role) tokenRoles.add(String(user.role).toUpperCase());
    if (user.systemRole) tokenRoles.add(String(user.systemRole).toUpperCase());
    if (Array.isArray(user.roles)) {
      for (const r of user.roles)
        if (r) tokenRoles.add(String(r).toUpperCase());
    }

    // SUPERADMIN passa em qualquer rota protegida
    if (tokenRoles.has("SUPERADMIN")) return true;

    return requiredRoles.some((r) => tokenRoles.has(String(r).toUpperCase()));
  }
}
