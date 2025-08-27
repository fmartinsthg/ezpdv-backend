import { randomUUID } from 'crypto';
import { PaymentGateway, CaptureRequest, RefundRequest, CancelRequest, GatewayResult } from './payment-gateway.interface';

/**
 * NullGateway
 * - Determinístico e síncrono; não depende de rede.
 * - Útil para testes locais e ambientes sem PSP real.
 */
export class NullGateway implements PaymentGateway {
  async capture(req: CaptureRequest): Promise<GatewayResult> {
    return {
      ok: true,
      provider: req.provider ?? 'NULL',
      providerTxnId: req.providerTxnId ?? `null_${randomUUID()}`,
      raw: { mode: 'capture', amountMinor: req.amountMinor },
    };
  }

  async refund(req: RefundRequest): Promise<GatewayResult> {
    return {
      ok: true,
      provider: req.provider,
      providerTxnId: req.providerTxnId,
      raw: { mode: 'refund', amountMinor: req.amountMinor, reason: req.reason },
    };
  }

  async cancel(req: CancelRequest): Promise<GatewayResult> {
    return {
      ok: true,
      provider: req.provider,
      providerTxnId: req.providerTxnId,
      raw: { mode: 'cancel', reason: req.reason },
    };
  }
}