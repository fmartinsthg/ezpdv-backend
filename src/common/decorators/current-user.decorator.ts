import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser()
 * Retorna o usuário autenticado anexado pelo JwtAuthGuard.
 * Ajuste se seu guard usa uma chave diferente de `req.user`.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user ?? null;
});