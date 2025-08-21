import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Extrai o tenantId do request (JWT, param ou header).
 * Uso: @TenantId() tenantId: string
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Prioridade: param > header > JWT
    return (
      request.params.tenantId ||
      request.headers["x-tenant-id"] ||
      request.user?.tenantId ||
      null
    );
  }
);
