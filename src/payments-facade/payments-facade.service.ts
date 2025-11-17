import { Injectable } from "@nestjs/common";
import { PaymentsService } from "../payments/payments.service";
import { PaymentIntentsService } from "../payment-intents/payment-intents.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentFromFacadeDto } from "./dto/create-payment-facade.dto";
import { RefundPaymentFromFacadeDto } from "./dto/refund-payment-facade.dto";
import { CreatePaymentDto } from "../payments/dto/create-payment.dto";
import { RefundPaymentDto } from "../payments/dto/refund-payment.dto";
import { PaymentIntentStatus, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

type PaymentSummary = { captured: string; refunded: string; net: string };
type ReconciledIntent = {
  id: string;
  status: "OPEN" | "COMPLETED";
  amountDue: string;
};
type ReconciledOrder = {
  id: string;
  total: string;
  paid: string;
  balance: string;
};

export type PaymentEnvelope = {
  payment?: any;
  refund?: any;
  order: ReconciledOrder;
  intent: ReconciledIntent;
  summary?: PaymentSummary;
};

function q2(v: any) {
  return new Decimal(v as any).toDecimalPlaces(2);
}

@Injectable()
export class PaymentsFacadeService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly intents: PaymentIntentsService,
    private readonly prisma: PrismaService
  ) {}

  private async computeAggregates(tenantId: string, orderId: string) {
    const [order, capturedAgg, refundedAgg] = await this.prisma.$transaction([
      this.prisma.order.findFirst({
        where: { id: orderId, tenantId },
        select: {
          id: true,
          total: true,
          isSettled: true,
          createdByUserId: true,
        },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId, orderId, status: PaymentStatus.CAPTURED },
        _sum: { amount: true },
      }),
      this.prisma.paymentTransaction.aggregate({
        where: { tenantId, type: "REFUND", payment: { orderId } },
        _sum: { amount: true },
      }),
    ]);

    if (!order) throw new Error("Order not found for this tenant");

    const orderTotal = q2(order.total);
    const captured = q2(capturedAgg._sum.amount ?? 0);
    const refunded = q2(refundedAgg._sum.amount ?? 0);
    const net = captured.minus(refunded);

    return { order, orderTotal, captured, refunded, net };
  }

  private async reconcile(
    tenantId: string,
    orderId: string
  ): Promise<{
    order: ReconciledOrder;
    intent: ReconciledIntent;
    summary: PaymentSummary;
  }> {
    const { order, orderTotal, captured, refunded, net } =
      await this.computeAggregates(tenantId, orderId);

    const intent = await this.intents.createOrGet(
      tenantId,
      orderId,
      order.createdByUserId,
      {}
    );

    const balanceDec = Decimal.max(orderTotal.minus(net), new Decimal(0));

    const reconciledIntent: ReconciledIntent = {
      id: intent.id,
      status:
        balanceDec.eq(0) ||
        order.isSettled ||
        intent.status === PaymentIntentStatus.COMPLETED
          ? "COMPLETED"
          : "OPEN",
      amountDue: balanceDec.toFixed(2),
    };

    const recOrder: ReconciledOrder = {
      id: order.id,
      total: orderTotal.toFixed(2),
      paid: net.toFixed(2),
      balance: balanceDec.toFixed(2),
    };

    const summary: PaymentSummary = {
      captured: captured.toFixed(2),
      refunded: refunded.toFixed(2),
      net: net.toFixed(2),
    };

    return { order: recOrder, intent: reconciledIntent, summary };
  }

  /** POST /tenants/:tenantId/orders/:orderId/payments */
  async capture(
    tenantId: string,
    orderId: string,
    userId: string,
    body: CreatePaymentFromFacadeDto
  ): Promise<PaymentEnvelope> {
    await this.intents.createOrGet(tenantId, orderId, userId, {});
    const dto: CreatePaymentDto = { ...body, orderId };
    const payment = await this.payments.capture(tenantId, dto, userId);
    const { order, intent, summary } = await this.reconcile(tenantId, orderId);
    return { payment, order, intent, summary };
  }

  /** POST /tenants/:tenantId/orders/:orderId/payments/:paymentId/refunds */
  async refund(
    tenantId: string,
    orderId: string,
    paymentId: string,
    userId: string,
    body: RefundPaymentFromFacadeDto
  ): Promise<PaymentEnvelope> {
    // Mapeia DTO do façade -> DTO core do módulo payments
    const dtoCore: RefundPaymentDto = {
      amount: body.amount,
      reason: body.reason,
    };

    // ✅ Assinatura real do seu service: (tenantId, paymentId, dto, approvalUserId)
    const refundTx = await this.payments.refund(
      tenantId,
      paymentId,
      dtoCore,
      userId
    );

    const { order, intent, summary } = await this.reconcile(tenantId, orderId);
    return { refund: refundTx, order, intent, summary };
  }

  /** GET /tenants/:tenantId/orders/:orderId/payments */
  async listByOrder(tenantId: string, orderId: string) {
    const payments = await this.payments.listByOrder(tenantId, orderId);
    const { order, intent, summary } = await this.reconcile(tenantId, orderId);
    return { payments, order, intent, summary };
  }

  /** GET /tenants/:tenantId/orders/:orderId/payments/:paymentId/transactions */
  async listTransactions(tenantId: string, orderId: string, paymentId: string) {
    const tx = await this.prisma.paymentTransaction.findMany({
      where: { tenantId, paymentId },
      orderBy: { createdAt: "asc" },
    });
    return { paymentId, orderId, transactions: tx };
  }
}
