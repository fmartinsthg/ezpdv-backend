import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";

/**
 * Garante que o tenantId está presente e válido no contexto do request.
 * - Admin/Staff: obtém do JWT
 * - SUPERADMIN: aceita via param ou header
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const isSuperAdmin = user?.role === "SUPERADMIN";
    const tenantId =
      request.params.tenantId ||
      request.headers["x-tenant-id"] ||
      user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException("tenantId obrigatório no contexto");
    }
    // (Opcional) Validar formato UUID aqui
    request.tenantId = tenantId;
    return true;
  }
}
