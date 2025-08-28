import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_SCOPE_META = 'IDEMPOTENCY_SCOPE_META';

/** Marca o handler com o escopo requerido */
export const Idempotent = (scopes: string | string[]) =>
  SetMetadata(
    IDEMPOTENCY_SCOPE_META,
    Array.isArray(scopes) ? scopes : [scopes],
  );
