// src/common/http/if-match.decorator.ts
import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const IfMatch = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const v = req.headers['if-match'];
  if (v == null) return undefined; // permita opcional
  const num = Number(v);
  if (!Number.isInteger(num) || num < 0) throw new BadRequestException('Invalid If-Match version');
  return num;
});
