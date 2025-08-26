export const IDEMPOTENCY_HEADERS = {
  KEY: 'idempotency-key',
  SCOPE: 'idempotency-scope',
  REPLAYED: 'Idempotency-Replayed',
};

export const IDEMPOTENCY_DEFAULTS = {
  SNAPSHOT_MAX_BYTES: 32 * 1024, // 32 KB
  RETRY_AFTER_SECONDS: 3,
  TTL_HOURS: 48,
};

// Escopos suportados (ampliar conforme módulos)
export const IDEMPOTENCY_ALLOWED_SCOPES = new Set<string>([
  'orders:create',
  'orders:appendItems',
  'orders:fire',
  'orders:voidItem',
  'orders:close',
  'orders:cancel',
  // futuros:
  // 'payments:capture', 'payments:refund', ...
]);
