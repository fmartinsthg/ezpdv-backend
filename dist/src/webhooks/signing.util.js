"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalJsonStringify = canonicalJsonStringify;
exports.hmacSha256Hex = hmacSha256Hex;
exports.buildSignedHeaders = buildSignedHeaders;
const crypto = __importStar(require("crypto"));
function canonicalJsonStringify(value) {
    const sort = (v) => {
        if (Array.isArray(v))
            return v.map(sort);
        if (v && typeof v === "object" && v.constructor === Object) {
            return Object.keys(v)
                .sort()
                .reduce((acc, k) => {
                acc[k] = sort(v[k]);
                return acc;
            }, {});
        }
        return v;
    };
    return JSON.stringify(sort(value));
}
function hmacSha256Hex(secret, message) {
    return crypto
        .createHmac("sha256", secret)
        .update(message, "utf8")
        .digest("hex");
}
/**
 * Padrão de assinatura:
 * - base = `${timestamp}.${bodyString}`
 * - header: X-Webhook-Signature: sha256=<hex>
 */
function buildSignedHeaders(opts) {
    const now = opts.nowMs ?? Date.now();
    const body = canonicalJsonStringify(opts.payload);
    const base = `${now}.${body}`;
    const sig = hmacSha256Hex(opts.secret, base);
    return {
        "X-Webhook-Id": opts.deliveryId,
        "X-Webhook-Event": opts.eventType,
        "X-Webhook-Timestamp": String(now),
        "X-Webhook-Signature": `sha256=${sig}`,
        "Idempotency-Key": opts.deliveryId,
        "Content-Type": "application/json",
    };
}
