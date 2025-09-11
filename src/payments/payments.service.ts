import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import {
  Prisma,
  PaymentStatus,
  PaymentMethod,
  PaymentTransactionType,
  PaymentIntentStatus,
  OrderStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from "./gateway/payment-gateway.interface";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { CancelPaymentDto } from "./dto/cancel-payment.dto";
import { WebhooksService } from "../webhooks/webhooks.service";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly webhooks: WebhooksService
  ) {}

  /** Quantiza valor monetário para 2 casas decimais (consistência). */
  private q2(v: Prisma.Decimal | string | number): Prisma.Decimal {
    return new Prisma.Decimal(v as any).toDecimalPlaces(2);
  }

  /** Converte para centavos (minor units) para gateways. */
  private toMinorUnits(amount: Prisma.Decimal | string | number): number {
    const v = this.q2(amount);
    return Number(v.times(100).toFixed(0));
  }

  async listByOrder(tenantId: string, orderId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId, orderId },
      orderBy: { createdAt: "asc" },
    });
  }

  async listByTenant(
    tenantId: string,
    query: {
      method?: PaymentMethod;
      status?: PaymentStatus;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const { method, status, dateFrom, dateTo, page = 1, pageSize = 20 } = query;

    const where: Prisma.PaymentWhereInput = {
      tenantId,
      ...(method ? { method } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lt: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Captura pagamentos APENAS para ordens CLOSED (consistente com o fluxo KDS -> close -> payments).
   * Gera eventos OrderEvent adequados e webhooks correspondentes.
   */
  async capture(
    tenantId: string,
    dto: CreatePaymentDto,
    currentUserId: string
  ) {
    const orderId = dto.orderId;
    const amount = this.q2(dto.amount);
    if (amount.lte(0)) throw new BadRequestException("Amount must be > 0");
    if (!currentUserId) throw new BadRequestException("Missing actor user id");

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Lock da order (somente CLOSED aceita pagamento)
        const order = await tx.$queryRaw<
          { id: string; status: OrderStatus; total: Prisma.Decimal }[]
        >`
            SELECT "id","status","total"
            FROM "Order"
            WHERE "id" = ${orderId} AND "tenantId" = ${tenantId}
            FOR UPDATE
          `.then((r) => r[0]);

        if (!order)
          throw new NotFoundException("Order not found for this tenant");
        if (order.status !== OrderStatus.CLOSED)
          throw new ConflictException("Only CLOSED orders accept payments");

        // Sumários (capturado líquido = capturado - reembolsado)
        const capturedAgg = await tx.payment.aggregate({
          where: { tenantId, orderId, status: PaymentStatus.CAPTURED },
          _sum: { amount: true },
        });
        const refundedAgg = await tx.paymentTransaction.aggregate({
          where: {
            tenantId,
            type: PaymentTransactionType.REFUND,
            payment: { orderId },
          },
          _sum: { amount: true },
        });

        const alreadyCaptured = this.q2(capturedAgg._sum.amount ?? 0);
        const alreadyRefunded = this.q2(refundedAgg._sum.amount ?? 0);
        const netCaptured = alreadyCaptured.minus(alreadyRefunded);
        const orderTotal = this.q2(order.total as any);

        if (netCaptured.add(amount).gt(orderTotal)) {
          throw new ConflictException({
            code: "PAYMENT_AMOUNT_EXCEEDS_DUE",
            message: "Captured sum would exceed order.total",
            details: {
              orderId: order.id,
              orderTotal: orderTotal.toString(),
              capturedSum: netCaptured.toString(),
              remainingDue: orderTotal.minus(netCaptured).toString(),
              requested: amount.toString(),
            },
          });
        }

        // Gateway (stub/mock)
        const gw = await this.gateway.capture({
          provider: dto.provider ?? "NULL",
          amountMinor: this.toMinorUnits(amount),
          currency: "BRL",
          providerTxnId: dto.providerTxnId,
          metadata: dto.metadata,
        });
        if (!gw.ok) throw new ConflictException("Gateway capture failed");

        // Tenta associar a um intent OPEN (se existir)
        const openIntent = await tx.paymentIntent.findFirst({
          where: { tenantId, orderId, status: PaymentIntentStatus.OPEN },
          orderBy: { createdAt: "desc" },
        });

        // 100% relacional; trava duplicidade por (tenantId, provider, providerTxnId)
        const data: Prisma.PaymentCreateInput = {
          method: dto.method,
          amount,
          status: PaymentStatus.CAPTURED,
          provider: gw.provider,
          providerTxnId: gw.providerTxnId ?? dto.providerTxnId ?? null,
          metadata: (dto.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue,

          tenant: { connect: { id: tenantId } },
          order: { connect: { id: orderId } },
          createdBy: { connect: { id: currentUserId } },
          ...(openIntent ? { intent: { connect: { id: openIntent.id } } } : {}),
        };

        let payment;
        try {
          payment = await tx.payment.create({ data });
        } catch (e: any) {
          // De-dupe: violação de unique (tenantId, provider, providerTxnId)
          if (
            e?.code === "P2002" &&
            (data.provider ?? dto.provider) &&
            (data.providerTxnId ?? dto.providerTxnId)
          ) {
            const existing = await tx.payment.findFirst({
              where: {
                tenantId,
                provider: data.provider!,
                providerTxnId: data.providerTxnId!,
              },
            });
            if (existing) {
              payment = existing;
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }

        await tx.paymentTransaction.create({
          data: {
            tenantId,
            paymentId: payment.id,
            type: PaymentTransactionType.CAPTURE,
            amount,
            byUserId: currentUserId,
            reason: "capture",
          },
        });

        // OrderEvent: pagamento capturado
        await tx.orderEvent.create({
          data: {
            tenantId,
            orderId,
            userId: currentUserId,
            eventType: "PAYMENT_CAPTURED",
            reason: `${payment.method}:${payment.id}`,
          },
        });

        // Se havia intent OPEN e quitou, marcar COMPLETED
        const newCaptured = netCaptured.add(amount);
        if (openIntent && newCaptured.gte(orderTotal)) {
          await tx.paymentIntent.update({
            where: { id: openIntent.id },
            data: { status: PaymentIntentStatus.COMPLETED },
          });
        }

        // Atualiza flags financeiras da Order + version bump
        let settledNow = false;
        if (newCaptured.gte(orderTotal)) {
          const current = await tx.order.findUnique({
            where: { id: orderId },
            select: { paidAt: true },
          });
          await tx.order.update({
            where: { id: orderId },
            data: {
              isSettled: true,
              paidAt: current?.paidAt ?? new Date(),
              version: { increment: 1 },
            },
          });
          settledNow = true;

          await tx.orderEvent.create({
            data: {
              tenantId,
              orderId,
              userId: currentUserId,
              eventType: "ORDER_SETTLED",
              reason: `captured=${newCaptured.toString()}`,
            },
          });
        } else {
          // mantém isSettled como está (normalmente false); ainda assim incrementa versão
          await tx.order.update({
            where: { id: orderId },
            data: { version: { increment: 1 } },
          });
        }

        return {
          payment,
          summary: {
            orderTotal: orderTotal.toString(),
            capturedSum: newCaptured.toString(),
            remainingDue: orderTotal.minus(newCaptured).toString(),
          },
          settledNow,
        };
      },
      { timeout: 20000 }
    );

    // Webhooks fora da transação
    try {
      await this.webhooks.queueEvent(
        tenantId,
        "payment.captured",
        {
          orderId: dto.orderId,
          paymentId: result.payment.id,
          amount: result.payment.amount,
          method: result.payment.method,
        },
        { deliverNow: true }
      );
      if (result.settledNow) {
        await this.webhooks.queueEvent(
          tenantId,
          "order.settled",
          { orderId: dto.orderId },
          { deliverNow: true }
        );
      }
    } catch {
      /* noop: não quebra o fluxo */
    }

    return { ...result.payment, summary: result.summary };
  }

  async refund(
    tenantId: string,
    paymentId: string,
    dto: RefundPaymentDto,
    approvalUserId: string
  ) {
    const amount = this.q2(dto.amount);
    if (amount.lte(0)) throw new BadRequestException("Amount must be > 0");
    if (!approvalUserId)
      throw new BadRequestException("Missing approval user id");

    const res = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
      });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status !== PaymentStatus.CAPTURED)
        throw new ConflictException("Only CAPTURED payments can be refunded");

      // Lock da ordem do pagamento
      await tx.$queryRaw`
        SELECT "id" FROM "Order"
        WHERE "id" = ${payment.orderId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      // Limite de reembolso por pagamento
      const refundedAgg = await tx.paymentTransaction.aggregate({
        where: { tenantId, paymentId, type: PaymentTransactionType.REFUND },
        _sum: { amount: true },
      });
      const alreadyRefundedForThisPayment = this.q2(
        refundedAgg._sum.amount ?? 0
      );
      const remainingForThisPayment = this.q2(payment.amount).minus(
        alreadyRefundedForThisPayment
      );

      if (amount.gt(remainingForThisPayment)) {
        throw new ConflictException(
          "Refund amount exceeds remaining captured amount for this payment"
        );
      }

      const gw = await this.gateway.refund({
        provider: payment.provider ?? "NULL",
        providerTxnId: payment.providerTxnId ?? "",
        amountMinor: this.toMinorUnits(amount),
        currency: "BRL",
        reason: dto.reason,
      });
      if (!gw.ok) throw new ConflictException("Gateway refund failed");

      await tx.paymentTransaction.create({
        data: {
          tenantId,
          paymentId: payment.id,
          type: PaymentTransactionType.REFUND,
          amount,
          byUserId: approvalUserId,
          reason: dto.reason,
        },
      });

      // Pode mudar o status do próprio pagamento
      const newRemainingForThisPayment = remainingForThisPayment.minus(amount);
      if (newRemainingForThisPayment.lte(0)) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
      }

      // OrderEvent: reembolso
      await tx.orderEvent.create({
        data: {
          tenantId,
          orderId: payment.orderId,
          userId: approvalUserId,
          eventType: "PAYMENT_REFUNDED",
          reason: dto.reason ?? `refund:${amount.toString()}`,
        },
      });

      // Recalcula posição financeira da ORDEM e ajusta flags
      const orderAgg = await tx.payment.aggregate({
        where: {
          tenantId,
          orderId: payment.orderId,
          status: PaymentStatus.CAPTURED,
        },
        _sum: { amount: true },
      });

      const refundsAgg = await tx.paymentTransaction.aggregate({
        where: {
          tenantId,
          type: PaymentTransactionType.REFUND,
          payment: { orderId: payment.orderId },
        },
        _sum: { amount: true },
      });

      const capturedForOrder = this.q2(orderAgg._sum.amount ?? 0);
      const refundedForOrder = this.q2(refundsAgg._sum.amount ?? 0);
      const netCapturedForOrder = capturedForOrder.minus(refundedForOrder);

      const orderRow = await tx.order.findUnique({
        where: { id: payment.orderId },
        select: { total: true, paidAt: true },
      });
      const orderTotal = this.q2(orderRow!.total as any);

      let unsettledNow = false;
      if (netCapturedForOrder.gte(orderTotal)) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            isSettled: true,
            paidAt: orderRow!.paidAt ?? new Date(),
            version: { increment: 1 },
          },
        });
      } else {
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            isSettled: false,
            paidAt: null,
            version: { increment: 1 },
          },
        });
        unsettledNow = true;

        await tx.orderEvent.create({
          data: {
            tenantId,
            orderId: payment.orderId,
            userId: approvalUserId,
            eventType: "ORDER_UNSETTLED",
            reason: `net=${netCapturedForOrder.toString()}`,
          },
        });
      }

      const updated = await tx.payment.findUnique({
        where: { id: payment.id },
      });

      return { updated, unsettledNow, orderId: payment.orderId, amount };
    });

    // Webhooks fora da transação
    try {
      await this.webhooks.queueEvent(
        tenantId,
        "payment.refunded",
        {
          paymentId,
          orderId: res.orderId,
          amount: res.amount,
        },
        { deliverNow: true }
      );
      if (res.unsettledNow) {
        await this.webhooks.queueEvent(
          tenantId,
          "order.unsettled",
          { orderId: res.orderId },
          { deliverNow: true }
        );
      }
    } catch {
      /* noop */
    }

    return res.updated!;
  }

  async cancel(
    tenantId: string,
    paymentId: string,
    dto: CancelPaymentDto,
    approvalUserId: string
  ) {
    if (!approvalUserId)
      throw new BadRequestException("Missing approval user id");

    const updated = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId },
      });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status !== PaymentStatus.PENDING)
        throw new ConflictException("Only PENDING payments can be canceled");

      const gw = await this.gateway.cancel({
        provider: payment.provider ?? "NULL",
        providerTxnId: payment.providerTxnId ?? "",
        reason: dto.reason,
      });
      if (!gw.ok) throw new ConflictException("Gateway cancel failed");

      const up = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELED },
      });

      await tx.paymentTransaction.create({
        data: {
          tenantId,
          paymentId: payment.id,
          type: PaymentTransactionType.CANCEL,
          amount: this.q2(0),
          byUserId: approvalUserId,
          reason: dto.reason ?? "cancel",
        },
      });

      // OrderEvent: cancelamento de pagamento
      await tx.orderEvent.create({
        data: {
          tenantId,
          orderId: payment.orderId,
          userId: approvalUserId,
          eventType: "PAYMENT_CANCELED",
          reason: dto.reason ?? "cancel",
        },
      });

      return up;
    });

    // Webhook fora da transação
    try {
      await this.webhooks.queueEvent(
        tenantId,
        "payment.canceled",
        {
          paymentId,
          orderId: updated.orderId,
        },
        { deliverNow: true }
      );
    } catch {
      /* noop */
    }

    // Observação: cancelamento de PENDING não altera somatórios capturados; não mexemos em isSettled/paidAt.
    return updated;
  }
}
