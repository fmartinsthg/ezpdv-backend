"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockGateway = void 0;
class MockGateway {
    constructor(opts = {}) {
        this.opts = opts;
    }
    async sleep() {
        const ms = this.opts.latencyMs ?? 350;
        return new Promise((r) => setTimeout(r, ms));
    }
    shouldFail() {
        const p = this.opts.failProbability ?? 0.05;
        return Math.random() < p;
    }
    async capture(req) {
        await this.sleep();
        if (this.shouldFail())
            throw new Error('MOCK PSP transient error on capture');
        return { ok: true, provider: req.provider ?? 'MOCK', providerTxnId: req.providerTxnId ?? `mock_${Date.now()}`, raw: { req } };
    }
    async refund(req) {
        await this.sleep();
        if (this.shouldFail())
            throw new Error('MOCK PSP transient error on refund');
        return { ok: true, provider: req.provider, providerTxnId: req.providerTxnId, raw: { req } };
    }
    async cancel(req) {
        await this.sleep();
        if (this.shouldFail())
            throw new Error('MOCK PSP transient error on cancel');
        return { ok: true, provider: req.provider, providerTxnId: req.providerTxnId, raw: { req } };
    }
}
exports.MockGateway = MockGateway;
