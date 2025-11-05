"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDEMPOTENCY_ALLOWED_SCOPES = exports.IDEMPOTENCY_DEFAULTS = exports.IDEMPOTENCY_HEADERS = void 0;
// src/common/idempotency/idempotency.constants.ts
exports.IDEMPOTENCY_HEADERS = {
    KEY: "idempotency-key", // sempre lower-case (req.headers)
    SCOPE: "idempotency-scope",
    REPLAYED: "idempotency-replayed",
};
exports.IDEMPOTENCY_DEFAULTS = {
    TTL_HOURS: 24,
    SNAPSHOT_MAX_BYTES: 32 * 1024, // 32 KB
    RETRY_AFTER_SECONDS: 3,
};
exports.IDEMPOTENCY_ALLOWED_SCOPES = new Set([
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
