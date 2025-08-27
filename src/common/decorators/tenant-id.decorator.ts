import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

/**
 * @TenantId()
 * Prioriza o valor definido pelo TenantContextGuard (req.tenantId).
 * Fallback: param de rota :tenantId ou header X-Tenant-Id.
 * Mantém o contrato multi-tenant mesmo se o guard não populou o request.
 */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();

  const fromGuard = req.tenantId;
  const fromParam = req.params?.tenantId;
  const fromHeader = req.headers?.['x-tenant-id'];

  const tenantId: string | undefined = fromGuard ?? fromParam ?? fromHeader;

  if (!tenantId || typeof tenantId !== 'string') {
    throw new BadRequestException('TenantId is required (missing in context, route param, or X-Tenant-Id header)');
  }
  return tenantId;
});
