export const IDEMPOTENCY_HEADERS = {
  KEY: 'idempotency-key',
  SCOPE: 'idempotency-scope',
  REPLAYED: 'idempotency-replayed',
};

export const IDEMPOTENCY_DEFAULTS = {
  SNAPSHOT_MAX_BYTES: 32 * 1024, // 32 KB
  RETRY_AFTER_SECONDS: 3,
  TTL_HOURS: 48,
};

// Escopos suportados (ampliar conforme módulos)
export const IDEMPOTENCY_ALLOWED_SCOPES = new Set<string>([
  // Orders
  'orders:create',
  'orders:append-items',
  'orders:void-item',
  'orders:fire',
  'orders:cancel',
  'orders:close',
  // Payments
  'payments:capture',
  'payments:refund',
  'payments:cancel',
  'payments:intent:create',
  'payments:authorize',
  'payments:pix:create',
  // Webhooks
  'webhooks:endpoints:create',
  'webhooks:replay',
]);
