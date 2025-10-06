import {
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from "@nestjs/common";

export const IDEMPOTENCY_SCOPE_META = "IDEMPOTENCY_SCOPE_META" as const;
export const IDEMPOTENCY_FORBIDDEN = '__IDEMPOTENCY_FORBIDDEN__' as const;

/**
 * Marca o handler com o(s) escopo(s) aceito(s) para idempotência.
 * Aceita string única ou array de strings. O Interceptor fará a
 * canonicalização (sinônimos) e a validação final.
 */
export const Idempotent = (scopes: string | string[]) =>
  SetMetadata(
    IDEMPOTENCY_SCOPE_META,
    Array.isArray(scopes) ? scopes : [scopes]
  );

/** Contexto de idempotência injetado pelo Interceptor no req */
export interface IdempotencyContext {
  /** UUID v4 da requisição */
  key: string;
  /** Escopo canônico (ex.: 'orders:append-items') */
  scope: string;
  /** SHA-256 do body canonizado */
  requestHash: string;
  /**
   * ID do registro na tabela de idempotência (preenchido após beginOrReplay).
   * Útil caso você queira finalizar manualmente dentro do service.
   */
  recordId?: string;
}

/**
 * Param decorator para acessar o contexto de idempotência preparado pelo Interceptor.
 * Ex.: `create(@IdempotencyCtx() idem?: IdempotencyContext)`
 */
export const IdempotencyCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IdempotencyContext | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req?.idempotency as IdempotencyContext | undefined;
  }
);
