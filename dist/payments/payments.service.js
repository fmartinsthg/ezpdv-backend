"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const payment_gateway_interface_1 = require("./gateway/payment-gateway.interface");
const library_1 = require("@prisma/client/runtime/library");
let PaymentsService = class PaymentsService {
    constructor(prisma, gateway) {
        this.prisma = prisma;
        this.gateway = gateway;
    }
    toMinorUnits(amount) {
        const v = new library_1.Decimal(amount);
        return Number(v.mul(100).toFixed(0));
    }
    async listByOrder(tenantId, orderId) {
        return this.prisma.payment.findMany({
            where: { tenantId, orderId },
            orderBy: { createdAt: 'asc' },
        });
    }
    async listByTenant(tenantId, query) {
        const { method, status, dateFrom, dateTo, page = 1, pageSize = 20 } = query;
        const where = {
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
    async capture(tenantId, dto, currentUserId) {
        const orderId = dto.orderId;
        const amount = new library_1.Decimal(dto.amount);
        if (amount.lte(0))
            throw new common_1.BadRequestException('Amount must be > 0');
        return this.prisma.$transaction(async (tx) => {
            const order = await tx.$queryRaw `
        SELECT "id","status","total" FROM "Order" WHERE "id" = ${orderId} AND "tenantId" = ${tenantId} FOR UPDATE
      `.then((r) => r[0]);
            if (!order)
                throw new common_1.NotFoundException('Order not found for this tenant');
            if (order.status !== 'CLOSED')
                throw new common_1.ConflictException('Only CLOSED orders accept payments');
            const capturedAgg = await tx.payment.aggregate({
                where: { tenantId, orderId, status: 'CAPTURED' },
                _sum: { amount: true },
            });
            const refundedAgg = await tx.paymentTransaction.aggregate({
                where: { tenantId, type: 'REFUND', payment: { orderId } },
                _sum: { amount: true },
            });
            const alreadyCaptured = new library_1.Decimal(capturedAgg._sum.amount ?? 0);
            const alreadyRefunded = new library_1.Decimal(refundedAgg._sum.amount ?? 0);
            const netCaptured = alreadyCaptured.minus(alreadyRefunded);
            const orderTotal = new library_1.Decimal(order.total);
            if (netCaptured.add(amount).gt(orderTotal)) {
                throw new common_1.ConflictException('Captured sum would exceed order.total');
            }
            const gw = await this.gateway.capture({
                provider: dto.provider ?? 'NULL',
                amountMinor: this.toMinorUnits(amount),
                currency: 'BRL',
                providerTxnId: dto.providerTxnId,
                metadata: dto.metadata,
            });
            if (!gw.ok)
                throw new common_1.ConflictException('Gateway capture failed');
            const payment = await tx.payment.create({
                data: {
                    tenantId,
                    orderId,
                    method: dto.method,
                    amount,
                    status: client_1.PaymentStatus.CAPTURED,
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
                    type: client_1.PaymentTransactionType.CAPTURE,
                    amount,
                    byUserId: currentUserId,
                    reason: 'capture',
                },
            });
            return payment;
        }, { timeout: 20000 });
    }
    async refund(tenantId, paymentId, dto, approvalUserId) {
        const amount = new library_1.Decimal(dto.amount);
        if (amount.lte(0))
            throw new common_1.BadRequestException('Amount must be > 0');
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
            if (!payment)
                throw new common_1.NotFoundException('Payment not found');
            if (payment.status !== client_1.PaymentStatus.CAPTURED)
                throw new common_1.ConflictException('Only CAPTURED payments can be refunded');
            await tx.$queryRaw `SELECT "id" FROM "Order" WHERE "id" = ${payment.orderId} AND "tenantId" = ${tenantId} FOR UPDATE`;
            const refundedAgg = await tx.paymentTransaction.aggregate({
                where: { tenantId, paymentId, type: 'REFUND' },
                _sum: { amount: true },
            });
            const alreadyRefunded = new library_1.Decimal(refundedAgg._sum.amount ?? 0);
            const remaining = new library_1.Decimal(payment.amount).minus(alreadyRefunded);
            if (amount.gt(remaining))
                throw new common_1.ConflictException('Refund amount exceeds remaining captured amount for this payment');
            const gw = await this.gateway.refund({
                provider: payment.provider ?? 'NULL',
                providerTxnId: payment.providerTxnId ?? '',
                amountMinor: this.toMinorUnits(amount),
                currency: 'BRL',
                reason: dto.reason,
            });
            if (!gw.ok)
                throw new common_1.ConflictException('Gateway refund failed');
            await tx.paymentTransaction.create({
                data: {
                    tenantId,
                    paymentId: payment.id,
                    type: client_1.PaymentTransactionType.REFUND,
                    amount,
                    byUserId: approvalUserId,
                    reason: dto.reason,
                },
            });
            const newRemaining = remaining.minus(amount);
            if (newRemaining.lte(0)) {
                await tx.payment.update({ where: { id: payment.id }, data: { status: client_1.PaymentStatus.REFUNDED } });
            }
            return tx.payment.findUnique({ where: { id: payment.id } });
        });
    }
    async cancel(tenantId, paymentId, dto, approvalUserId) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
            if (!payment)
                throw new common_1.NotFoundException('Payment not found');
            if (payment.status !== client_1.PaymentStatus.PENDING)
                throw new common_1.ConflictException('Only PENDING payments can be canceled');
            const gw = await this.gateway.cancel({
                provider: payment.provider ?? 'NULL',
                providerTxnId: payment.providerTxnId ?? '',
                reason: dto.reason,
            });
            if (!gw.ok)
                throw new common_1.ConflictException('Gateway cancel failed');
            const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: client_1.PaymentStatus.CANCELED } });
            await tx.paymentTransaction.create({
                data: {
                    tenantId,
                    paymentId: payment.id,
                    type: client_1.PaymentTransactionType.CANCEL,
                    amount: new library_1.Decimal(0),
                    byUserId: approvalUserId,
                    reason: dto.reason ?? 'cancel',
                },
            });
            return updated;
        });
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(payment_gateway_interface_1.PAYMENT_GATEWAY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], PaymentsService);
