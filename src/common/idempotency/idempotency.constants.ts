// src/common/idempotency/idempotency.constants.ts
export const IDEMPOTENCY_HEADERS = {
  KEY: "idempotency-key", // sempre lower-case (req.headers)
  SCOPE: "idempotency-scope",
  REPLAYED: "idempotency-replayed",
} as const;

export const IDEMPOTENCY_DEFAULTS = {
  TTL_HOURS: 24,
  SNAPSHOT_MAX_BYTES: 32 * 1024, // 32 KB
  RETRY_AFTER_SECONDS: 3,
};

export const IDEMPOTENCY_ALLOWED_SCOPES = new Set<string>([
  // CANÔNICOS
  "orders:create",
  "orders:append-items",
  "orders:void-item",
  "orders:fire",
  "orders:cancel",
  "orders:close",
  "payments:capture",
  "payments:refund",
  "payments:cancel",
  "webhooks:endpoints:create",
  "webhooks:replay",
]);
