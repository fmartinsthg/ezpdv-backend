import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { TENANT_HEADER, TenantErrors } from './tenant.constants';

type JwtUser = {
  sub: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'MODERATOR' | 'USER';
  tenantId?: string | null;
};

@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = (req.user || {}) as JwtUser;

    if (!user || !user.role) {
      // JwtAuthGuard deve ter rodado antes
      throw new ForbiddenException('Usuário não autenticado.');
    }

    let resolvedTenantId: string | undefined;

    if (user.role === 'SUPERADMIN') {
      // SUPERADMIN escolhe o tenant via header
      const headerValue =
        (req.headers[TENANT_HEADER] as string) ||
        (req.headers[TENANT_HEADER.toUpperCase()] as string);
      if (!headerValue) {
        throw new BadRequestException(TenantErrors.MISSING_HEADER_FOR_SUPERADMIN);
      }
      resolvedTenantId = headerValue;
    } else {
      // Demais roles usam o tenant do token
      if (!user.tenantId) {
        throw new ForbiddenException(TenantErrors.MISSING_TENANT_IN_TOKEN);
      }
      resolvedTenantId = user.tenantId;
    }

    // Anexa ao request para Decorators/Services
    req.tenantId = resolvedTenantId;
    return true;
  }
}