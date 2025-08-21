import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";

/**
 * Injeta tenantId no request/ExecutionContext para fácil acesso em services/controllers.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    // Prioridade: param > header > JWT
    request.tenantId =
      request.params.tenantId ||
      request.headers["x-tenant-id"] ||
      request.user?.tenantId ||
      null;
    return next.handle();
  }
}
