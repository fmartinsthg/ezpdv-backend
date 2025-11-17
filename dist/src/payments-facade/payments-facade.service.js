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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsFacadeService = void 0;
const common_1 = require("@nestjs/common");
const payments_service_1 = require("../payments/payments.service");
const payment_intents_service_1 = require("../payment-intents/payment-intents.service");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
function q2(v) {
    return new library_1.Decimal(v).toDecimalPlaces(2);
}
let PaymentsFacadeService = class PaymentsFacadeService {
    constructor(payments, intents, prisma) {
        this.payments = payments;
        this.intents = intents;
        this.prisma = prisma;
    }
    /** Soma capturas (CAPTURED) e refunds (REFUND) da order. */
    async computeAggregates(tenantId, orderId) {
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
                where: { tenantId, orderId, status: client_1.PaymentStatus.CAPTURED },
                _sum: { amount: true },
            }),
            this.prisma.paymentTransaction.aggregate({
                where: { tenantId, type: "REFUND", payment: { orderId } },
                _sum: { amount: true },
            }),
        ]);
        if (!order)
            throw new Error("Order not found for this tenant");
        const orderTotal = q2(order.total);
        const captured = q2(capturedAgg._sum.amount ?? 0);
        const refunded = q2(refundedAgg._sum.amount ?? 0);
        const net = captured.minus(refunded);
        return { order, orderTotal, captured, refunded, net };
    }
    /** Concilia order + intent + summary. Garante que exista um intent. */
    async reconcile(tenantId, orderId) {
        const { order, orderTotal, captured, refunded, net } = await this.computeAggregates(tenantId, orderId);
        // garante/obtém intent OPEN/COMPLETED (nota: createOrGet não aceita currency)
        const intent = await this.intents.createOrGet(tenantId, orderId, order.createdByUserId, {});
        const balance = orderTotal.minus(net).max(0);
        const reconciledIntent = {
            id: intent.id,
            status: balance.eq(0) ||
                order.isSettled ||
                intent.status === client_1.PaymentIntentStatus.COMPLETED
                ? "COMPLETED"
                : "OPEN",
            amountDue: balance.toFixed(2),
        };
        const recOrder = {
            id: order.id,
            total: orderTotal.toFixed(2),
            paid: net.toFixed(2),
            balance: balance.toFixed(2),
        };
        const summary = {
            captured: captured.toFixed(2),
            refunded: refunded.toFixed(2),
            net: net.toFixed(2),
        };
        return { order: recOrder, intent: reconciledIntent, summary };
    }
    /** POST /tenants/:tenantId/orders/:orderId/payments */
    async capture(tenantId, orderId, userId, body) {
        // garante/abre intent (não exposto ao front)
        await this.intents.createOrGet(tenantId, orderId, userId, {});
        // monta o DTO oficial exigido pelo serviço de payments (inclui orderId)
        const dto = { ...body, orderId };
        const payment = await this.payments.capture(tenantId, dto, userId);
        const { order, intent, summary } = await this.reconcile(tenantId, orderId);
        return { payment, order, intent, summary };
    }
    /** POST /tenants/:tenantId/orders/:orderId/payments/:paymentId/refunds */
    async refund(tenantId, orderId, paymentId, userId, dto) {
        const refundTx = await this.payments.refund(tenantId, paymentId, userId, dto);
        const { order, intent, summary } = await this.reconcile(tenantId, orderId);
        return { refund: refundTx, order, intent, summary };
    }
    /** GET /tenants/:tenantId/orders/:orderId/payments */
    async listByOrder(tenantId, orderId) {
        const payments = await this.payments.listByOrder(tenantId, orderId);
        const { order, intent, summary } = await this.reconcile(tenantId, orderId);
        return { payments, order, intent, summary };
    }
    /** GET /tenants/:tenantId/orders/:orderId/payments/:paymentId/transactions */
    async listTransactions(tenantId, orderId, paymentId) {
        // Consulta direta (já que o serviço não expõe)
        const tx = await this.prisma.paymentTransaction.findMany({
            where: { tenantId, paymentId },
            orderBy: { createdAt: "asc" },
        });
        return { paymentId, orderId, transactions: tx };
    }
};
exports.PaymentsFacadeService = PaymentsFacadeService;
exports.PaymentsFacadeService = PaymentsFacadeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        payment_intents_service_1.PaymentIntentsService,
        prisma_service_1.PrismaService])
], PaymentsFacadeService);
