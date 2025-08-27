import { PaymentGateway, CaptureRequest, RefundRequest, CancelRequest, GatewayResult } from './payment-gateway.interface';

export class MockGateway implements PaymentGateway {
  constructor(private readonly opts: { failProbability?: number; latencyMs?: number } = {}) {}

  private async sleep() {
    const ms = this.opts.latencyMs ?? 350;
    return new Promise((r) => setTimeout(r, ms));
  }

  private shouldFail() {
    const p = this.opts.failProbability ?? 0.05;
    return Math.random() < p;
  }

  async capture(req: CaptureRequest): Promise<GatewayResult> {
    await this.sleep();
    if (this.shouldFail()) throw new Error('MOCK PSP transient error on capture');
    return { ok: true, provider: req.provider ?? 'MOCK', providerTxnId: req.providerTxnId ?? `mock_${Date.now()}`, raw: { req } };
  }

  async refund(req: RefundRequest): Promise<GatewayResult> {
    await this.sleep();
    if (this.shouldFail()) throw new Error('MOCK PSP transient error on refund');
    return { ok: true, provider: req.provider, providerTxnId: req.providerTxnId, raw: { req } };
  }

  async cancel(req: CancelRequest): Promise<GatewayResult> {
    await this.sleep();
    if (this.shouldFail()) throw new Error('MOCK PSP transient error on cancel');
    return { ok: true, provider: req.provider, providerTxnId: req.providerTxnId, raw: { req } };
  }
}