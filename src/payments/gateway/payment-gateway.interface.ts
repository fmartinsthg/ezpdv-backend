export interface CaptureRequest {
  provider?: string;
  amountMinor: number;
  currency: string; // 'BRL'
  providerTxnId?: string;
  metadata?: Record<string, any>;
}

export interface GatewayResult {
  ok: boolean;
  provider: string;
  providerTxnId: string;
  raw?: any;
}

export interface RefundRequest {
  provider: string;
  providerTxnId: string;
  amountMinor: number;
  currency: string;
  reason?: string;
}

export interface CancelRequest {
  provider: string;
  providerTxnId: string;
  reason?: string;
}

export interface PaymentGateway {
  capture(req: CaptureRequest): Promise<GatewayResult>;
  refund(req: RefundRequest): Promise<GatewayResult>;
  cancel(req: CancelRequest): Promise<GatewayResult>;
}

// Injection token (runtime)
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
