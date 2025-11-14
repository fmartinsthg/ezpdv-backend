// src/common/idempotency/idempotency.constants.ts
export const IDEMPOTENCY_HEADERS = {
  KEY: "idempotency-key",
  SCOPE: "idempotency-scope",
  REPLAYED: "idempotency-replayed",
} as const;

export const IDEMPOTENCY_DEFAULTS = {
  TTL_HOURS: 24,
  SNAPSHOT_MAX_BYTES: 32 * 1024, // 32 KB
  RETRY_AFTER_SECONDS: 3,
  INFLIGHT_SECONDS: 30,          
  STALE_TAKEOVER_SECONDS: 60,
};

export const IDEMPOTENCY_ALLOWED_SCOPES = new Set<string>([
  "orders:create",
  "orders:append-items",
  "orders:void-item",
  "orders:fire",
  "orders:cancel",
  "orders:close",

  "payments:capture",
  "payments:refund",
  "payments:cancel",
  "payments:intent:create",

  "webhooks:endpoints:create",
  "webhooks:replay",

  "inventory:create-item",
  "inventory:update-item",
  "inventory:adjust-item",
  "inventory:upsert-recipe",
]);
