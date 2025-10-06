"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalJsonStringify = canonicalJsonStringify;
exports.sha256Hex = sha256Hex;
exports.isUuidV4 = isUuidV4;
// src/common/idempotency/idempotency.util.ts
const node_crypto_1 = __importDefault(require("node:crypto"));
function canonicalJsonStringify(obj) {
    // ordena chaves para hashing determinístico
    const sort = (o) => Array.isArray(o)
        ? o.map(sort)
        : o && typeof o === 'object'
            ? Object.keys(o).sort().reduce((acc, k) => (acc[k] = sort(o[k]), acc), {})
            : o;
    return JSON.stringify(sort(obj ?? {}));
}
function sha256Hex(s) {
    return node_crypto_1.default.createHash('sha256').update(s, 'utf8').digest('hex');
}
function isUuidV4(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
