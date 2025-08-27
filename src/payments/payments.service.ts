import { BadRequestException, ConflictException, Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Prisma, PaymentStatus, PaymentMethod, PaymentTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY, PaymentGateway } from './gateway/payment-gateway.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { CancelPaymentDto } from './dto/cancel-payment.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  private toMinorUnits(amount: Decimal | string): number {
    const v = new Decimal(amount as any);
    return Number(v.mul(100).toFixed(0));
  }

  async listByOrder(tenantId: string, orderId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId, orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listByTenant(tenantId: string, query: {
    method?: PaymentMethod;
    status?: PaymentStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { method, status, dateFrom, dateTo, page = 1, pageSize = 20 } = query;
    const where: Prisma.PaymentWhereInput = {
      tenantId,
      ...(method ? { method } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lt: new Date(dateTo) } : {}),
        },
      } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async capture(tenantId: string, dto: CreatePaymentDto, currentUserId: string) {
    const orderId = dto.orderId;
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Amount must be > 0');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.$queryRaw<{ id: string; status: string; total: Decimal }[]>`
        SELECT "id","status","total" FROM "Order" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE
      `.then((r) => r[0]);

      if (!order) throw new NotFoundException('Order not found for this tenant');
      if (order.status !== 'CLOSED') throw new ConflictException('Only CLOSED orders accept payments');

      const capturedAgg = await tx.payment.aggregate({
        where: { tenantId, orderId, status: 'CAPTURED' },
        _sum: { amount: true },
      });
      const refundedAgg = await tx.paymentTransaction.aggregate({
        where: { tenantId, type: 'REFUND', payment: { orderId } },
        _sum: { amount: true },
      });

      const alreadyCaptured = new Decimal(capturedAgg._sum.amount ?? 0);
      const alreadyRefunded = new Decimal(refundedAgg._sum.amount ?? 0);
      const netCaptured = alreadyCaptured.minus(alreadyRefunded);
      const orderTotal = new Decimal(order.total as any);

      if (netCaptured.add(amount).gt(orderTotal)) {
        throw new ConflictException('Captured sum would exceed order.total');
      }

      const gw = await this.gateway.capture({
        provider: dto.provider ?? 'NULL',
        amountMinor: this.toMinorUnits(amount),
        currency: 'BRL',
        providerTxnId: dto.providerTxnId,
        metadata: dto.metadata,
      });
      if (!gw.ok) throw new ConflictException('Gateway capture failed');

      const payment = await tx.payment.create({
        data: {
          tenantId,
          orderId,
          method: dto.method,
          amount,
          status: PaymentStatus.CAPTURED,
          provider: gw.provider,
          providerTxnId: gw.providerTxnId,
          metadata: dto.metadata,
          createdByUserId: currentUserId,
        },
      });

      await tx.paymentTransaction.create({
        data: {
          tenantId,
          paymentId: payment.id,
          type: PaymentTransactionType.CAPTURE,
          amount,
          byUserId: currentUserId,
          reason: 'capture',
        },
      });

      return payment;
    }, { timeout: 20000 });
  }

  async refund(tenantId: string, paymentId: string, dto: RefundPaymentDto, approvalUserId: string) {
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Amount must be > 0');

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== PaymentStatus.CAPTURED) throw new ConflictException('Only CAPTURED payments can be refunded');

      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;

      const refundedAgg = await tx.paymentTransaction.aggregate({
        where: { tenantId, paymentId, type: 'REFUND' },
        _sum: { amount: true },
      });
      const alreadyRefunded = new Decimal(refundedAgg._sum.amount ?? 0);
      const remaining = new Decimal(payment.amount).minus(alreadyRefunded);
      if (amount.gt(remaining)) throw new ConflictException('Refund amount exceeds remaining captured amount for this payment');

      const gw = await this.gateway.refund({
        provider: payment.provider ?? 'NULL',
        providerTxnId: payment.providerTxnId ?? '',
        amountMinor: this.toMinorUnits(amount),
        currency: 'BRL',
        reason: dto.reason,
      });
      if (!gw.ok) throw new ConflictException('Gateway refund failed');

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

      const newRemaining = remaining.minus(amount);
      if (newRemaining.lte(0)) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REFUNDED } });
      }

      return tx.payment.findUnique({ where: { id: payment.id } });
    });
  }

  async cancel(tenantId: string, paymentId: string, dto: CancelPaymentDto, approvalUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== PaymentStatus.PENDING) throw new ConflictException('Only PENDING payments can be canceled');

      const gw = await this.gateway.cancel({
        provider: payment.provider ?? 'NULL',
        providerTxnId: payment.providerTxnId ?? '',
        reason: dto.reason,
      });
      if (!gw.ok) throw new ConflictException('Gateway cancel failed');

      const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.CANCELED } });

      await tx.paymentTransaction.create({
        data: {
          tenantId,
          paymentId: payment.id,
          type: PaymentTransactionType.CANCEL,
          amount: new Decimal(0),
          byUserId: approvalUserId,
          reason: dto.reason ?? 'cancel',
        },
      });

      return updated;
    });
  }
}
