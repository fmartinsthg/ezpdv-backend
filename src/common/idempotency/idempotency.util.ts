// src/common/idempotency/idempotency.util.ts
import crypto from 'node:crypto';

export function canonicalJsonStringify(obj: any): string {
  // ordena chaves para hashing determinístico
  const sort = (o: any): any =>
    Array.isArray(o)
      ? o.map(sort)
      : o && typeof o === 'object'
      ? Object.keys(o).sort().reduce((acc, k) => (acc[k] = sort(o[k]), acc), {} as any)
      : o;
  return JSON.stringify(sort(obj ?? {}));
}

export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export function isUuidV4(v?: string) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
