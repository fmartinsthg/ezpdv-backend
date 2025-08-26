import { createHash } from 'crypto';

/** Ordena chaves recursivamente e serializa de forma determinística */
export function canonicalJsonStringify(value: any): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const obj: any = {};
    for (const k of keys) {
      const v = (value as any)[k];
      // Remover nulls redundantes (opcional: ajuste conforme semântica)
      if (v === undefined) continue;
      obj[k] = sortValue(v);
    }
    return obj;
  }
  // Para números, apenas deixe como estão (se quiser, converta para string decimal)
  return value;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function isUuidV4(str?: string): boolean {
  if (!str) return false;
  // UUID v4 (simplificada)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}
