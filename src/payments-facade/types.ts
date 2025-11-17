export type PaymentSummary = { captured: string; refunded: string; net: string };
export type ReconciledIntent = { id: string; status: 'OPEN'|'COMPLETED'; amountDue: string };
export type ReconciledOrder = { id: string; total: string; paid: string; balance: string };

export type PaymentEnvelope = {
  payment?: any;            // Payment (do seu serviço)
  refund?: any;             // PaymentTransaction REFUND
  order: ReconciledOrder;
  intent: ReconciledIntent;
  summary?: PaymentSummary; // opcional em GET list
};