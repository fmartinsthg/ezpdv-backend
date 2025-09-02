// src/orders/order.presenter.ts
import { Prisma } from '@prisma/client';

const toMoney = (v: any) =>
  v == null ? null : (Prisma.Decimal.isDecimal(v) ? (v as Prisma.Decimal).toFixed(2) : String(v));

const toIso = (d?: Date | null) => (d ? d.toISOString() : null);

export function presentOrder(o: any) {
  return {
    id: o.id,
    tenantId: o.tenantId,
    status: o.status,
    subtotal: toMoney(o.subtotal),
    discount: toMoney(o.discount),
    total: toMoney(o.total),
    tabNumber: o.tabNumber,
    idempotencyKey: o.idempotencyKey ?? null,
    version: o.version,
    createdByUserId: o.createdByUserId,
    assignedToUserId: o.assignedToUserId,
    cashierUserId: o.cashierUserId ?? null,
    createdAt: toIso(o.createdAt),
    updatedAt: toIso(o.updatedAt),
    isSettled: o.isSettled ?? (o.status === 'PAID' || o.status === 'CLOSED'),
    paidAt: toIso(o.paidAt),
    items: (o.items ?? []).map((it: any) => ({
      id: it.id,
      orderId: it.orderId,
      tenantId: it.tenantId,
      productId: it.productId,
      status: it.status,
      station: it.station ?? null,
      quantity: toMoney(it.quantity),
      unitPrice: toMoney(it.unitPrice),
      total: toMoney(it.total),
      notes: it.notes ?? null,
      firedAt: toIso(it.firedAt),
      voidedAt: toIso(it.voidedAt),
      voidReason: it.voidReason ?? null,
      voidByUserId: it.voidByUserId ?? null,
      voidApprovedBy: it.voidApprovedBy ?? null,
      createdAt: toIso(it.createdAt),
      updatedAt: toIso(it.updatedAt),
    })),
    payments: (o.payments ?? []).map((p: any) => ({
      id: p.id,
      method: p.method,
      amount: toMoney(p.amount),
      status: p.status,
      provider: p.provider ?? null,
      providerTxnId: p.providerTxnId ?? null,
      paidAt: toIso(p.paidAt),
      createdAt: toIso(p.createdAt),
    })),
  };
}
