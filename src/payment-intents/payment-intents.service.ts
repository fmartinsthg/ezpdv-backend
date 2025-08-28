import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PaymentIntentStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

function q2(v: any) { return new Decimal(v as any).toDecimalPlaces(2); }

@Injectable()
export class PaymentIntentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGet(
    tenantId: string,
    orderId: string,
    userId: string,
    dto: { expiresAt?: string },
  ) {
    if (!userId) throw new BadRequestException('Missing actor id');

    return this.prisma.$transaction(async (tx) => {
      // Lock da ordem
      const order = await tx.$queryRaw<{ id: string; status: string; total: Decimal }[]>`
        SELECT "id","status","total"
        FROM "Order"
        WHERE "id" = ${orderId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `.then(r => r[0]);

      if (!order) throw new NotFoundException('Order not found for this tenant');
      if (order.status !== 'CLOSED') throw new ConflictException('Only CLOSED orders accept intents');

      // Somas já capturadas líquidas
      const capturedAgg = await tx.payment.aggregate({
        where: { tenantId, orderId, status: PaymentStatus.CAPTURED },
        _sum: { amount: true },
      });
      const refundedAgg = await tx.paymentTransaction.aggregate({
        where: { tenantId, type: 'REFUND', payment: { orderId } },
        _sum: { amount: true },
      });
      const orderTotal = q2(order.total);
      const netCaptured = q2(capturedAgg._sum.amount ?? 0).minus(q2(refundedAgg._sum.amount ?? 0));
      const remainingDue = orderTotal.minus(netCaptured);
      if (remainingDue.lte(0)) {
        // já está quitado; retornar intent COMPLETED se existir, senão sintetizar
        const existingCompleted = await tx.paymentIntent.findFirst({
          where: { tenantId, orderId, status: PaymentIntentStatus.COMPLETED },
          orderBy: { createdAt: 'desc' },
        });
        if (existingCompleted) return existingCompleted;
        // cria um COMPLETED apenas para rastreio (idempotente por negócio)
        return tx.paymentIntent.create({
          data: {
            tenantId, orderId,
            amountDue: orderTotal,
            status: PaymentIntentStatus.COMPLETED,
            currency: 'BRL',
            createdByUserId: userId,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          },
        });
      }

      // Se já existir um OPEN, retorna (idempotente por negócio)
      const existing = await tx.paymentIntent.findFirst({
        where: { tenantId, orderId, status: PaymentIntentStatus.OPEN },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;

      // Cria um novo OPEN com amountDue = restante
      return tx.paymentIntent.create({
        data: {
          tenantId,
          orderId,
          currency: 'BRL',
          amountDue: remainingDue,
          status: PaymentIntentStatus.OPEN,
          createdByUserId: userId,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
    });
  }

  async getById(tenantId: string, intentId: string) {
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { id: intentId, tenantId },
    });
    if (!intent) throw new NotFoundException('PaymentIntent not found');
    return intent;
  }

  /** Auxiliar: tenta completar intent se quitado */
  async tryCompleteIntentForOrder(tx: Prisma.TransactionClient, tenantId: string, orderId: string) {
    const openIntent = await tx.paymentIntent.findFirst({
      where: { tenantId, orderId, status: PaymentIntentStatus.OPEN },
      orderBy: { createdAt: 'desc' },
    });
    if (!openIntent) return;

    const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
    if (!order) return;

    const capturedAgg = await tx.payment.aggregate({
      where: { tenantId, orderId, status: PaymentStatus.CAPTURED },
      _sum: { amount: true },
    });
    const refundedAgg = await tx.paymentTransaction.aggregate({
      where: { tenantId, type: 'REFUND', payment: { orderId } },
      _sum: { amount: true },
    });

    const total = q2(order.total);
    const netCaptured = q2(capturedAgg._sum.amount ?? 0).minus(q2(refundedAgg._sum.amount ?? 0));

    if (netCaptured.gte(total)) {
      await tx.paymentIntent.update({
        where: { id: openIntent.id },
        data: { status: PaymentIntentStatus.COMPLETED },
      });
    }
  }
}
