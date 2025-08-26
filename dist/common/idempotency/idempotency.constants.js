"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDEMPOTENCY_ALLOWED_SCOPES = exports.IDEMPOTENCY_DEFAULTS = exports.IDEMPOTENCY_HEADERS = void 0;
exports.IDEMPOTENCY_HEADERS = {
    KEY: 'idempotency-key',
    SCOPE: 'idempotency-scope',
    REPLAYED: 'Idempotency-Replayed',
};
exports.IDEMPOTENCY_DEFAULTS = {
    SNAPSHOT_MAX_BYTES: 32 * 1024, // 32 KB
    RETRY_AFTER_SECONDS: 3,
    TTL_HOURS: 48,
};
// Escopos suportados (ampliar conforme módulos)
exports.IDEMPOTENCY_ALLOWED_SCOPES = new Set([
    'orders:create',
    'orders:appendItems',
    'orders:fire',
    'orders:voidItem',
    'orders:close',
    'orders:cancel',
    // futuros:
    // 'payments:capture', 'payments:refund', ...
]);
