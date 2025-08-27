"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NullGateway = void 0;
const crypto_1 = require("crypto");
/**
 * NullGateway
 * - Determinístico e síncrono; não depende de rede.
 * - Útil para testes locais e ambientes sem PSP real.
 */
class NullGateway {
    async capture(req) {
        return {
            ok: true,
            provider: req.provider ?? 'NULL',
            providerTxnId: req.providerTxnId ?? `null_${(0, crypto_1.randomUUID)()}`,
            raw: { mode: 'capture', amountMinor: req.amountMinor },
        };
    }
    async refund(req) {
        return {
            ok: true,
            provider: req.provider,
            providerTxnId: req.providerTxnId,
            raw: { mode: 'refund', amountMinor: req.amountMinor, reason: req.reason },
        };
    }
    async cancel(req) {
        return {
            ok: true,
            provider: req.provider,
            providerTxnId: req.providerTxnId,
            raw: { mode: 'cancel', reason: req.reason },
        };
    }
}
exports.NullGateway = NullGateway;
