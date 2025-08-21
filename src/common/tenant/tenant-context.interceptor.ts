import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantErrors } from './tenant.constants';

type JwtUser = {
  sub: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'MODERATOR' | 'USER';
  tenantId?: string | null;
};

@Injectable()
export class TenantRouteValidationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = (req.user || {}) as JwtUser;
    const routeTenantId: string | undefined = req.params?.tenantId;
    const ctxTenantId: string | undefined = req.tenantId;

    // Se a rota tiver :tenantId, validamos contra o tenant do contexto
    if (routeTenantId) {
      // Para SUPERADMIN, aceitamos :tenantId desde que seja igual ao escolhido via header
      // Para demais roles, deve sempre bater com o tenant do token
      if (!ctxTenantId || routeTenantId !== ctxTenantId) {
        throw new ForbiddenException(TenantErrors.PATH_TENANT_MISMATCH);
      }
    }

    return next.handle();
  }
}
