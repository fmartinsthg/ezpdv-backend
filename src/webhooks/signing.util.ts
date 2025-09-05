import * as crypto from "crypto";

export function canonicalJsonStringify(value: any): string {
  const sort = (v: any): any => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object" && v.constructor === Object) {
      return Object.keys(v)
        .sort()
        .reduce((acc: any, k) => {
          acc[k] = sort(v[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

export function hmacSha256Hex(secret: string, message: string): string {
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
export function buildSignedHeaders(opts: {
  deliveryId: string;
  eventType: string;
  secret: string;
  payload: any;
  nowMs?: number;
}) {
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
