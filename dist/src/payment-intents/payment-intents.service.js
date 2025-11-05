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
exports.PaymentIntentsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
function q2(v) { return new library_1.Decimal(v).toDecimalPlaces(2); }
let PaymentIntentsService = class PaymentIntentsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createOrGet(tenantId, orderId, userId, dto) {
        if (!userId)
            throw new common_1.BadRequestException('Missing actor id');
        return this.prisma.$transaction(async (tx) => {
            // Lock da ordem
            const order = await tx.$queryRaw `
        SELECT "id","status","total"
        FROM "Order"
        WHERE "id" = ${orderId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `.then(r => r[0]);
            if (!order)
                throw new common_1.NotFoundException('Order not found for this tenant');
            if (order.status !== 'CLOSED')
                throw new common_1.ConflictException('Only CLOSED orders accept intents');
            // Somas já capturadas líquidas
            const capturedAgg = await tx.payment.aggregate({
                where: { tenantId, orderId, status: client_1.PaymentStatus.CAPTURED },
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
                    where: { tenantId, orderId, status: client_1.PaymentIntentStatus.COMPLETED },
                    orderBy: { createdAt: 'desc' },
                });
                if (existingCompleted)
                    return existingCompleted;
                // cria um COMPLETED apenas para rastreio (idempotente por negócio)
                return tx.paymentIntent.create({
                    data: {
                        tenantId, orderId,
                        amountDue: orderTotal,
                        status: client_1.PaymentIntentStatus.COMPLETED,
                        currency: 'BRL',
                        createdByUserId: userId,
                        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                    },
                });
            }
            // Se já existir um OPEN, retorna (idempotente por negócio)
            const existing = await tx.paymentIntent.findFirst({
                where: { tenantId, orderId, status: client_1.PaymentIntentStatus.OPEN },
                orderBy: { createdAt: 'desc' },
            });
            if (existing)
                return existing;
            // Cria um novo OPEN com amountDue = restante
            return tx.paymentIntent.create({
                data: {
                    tenantId,
                    orderId,
                    currency: 'BRL',
                    amountDue: remainingDue,
                    status: client_1.PaymentIntentStatus.OPEN,
                    createdByUserId: userId,
                    expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
                },
            });
        });
    }
    async getById(tenantId, intentId) {
        const intent = await this.prisma.paymentIntent.findFirst({
            where: { id: intentId, tenantId },
        });
        if (!intent)
            throw new common_1.NotFoundException('PaymentIntent not found');
        return intent;
    }
    /** Auxiliar: tenta completar intent se quitado */
    async tryCompleteIntentForOrder(tx, tenantId, orderId) {
        const openIntent = await tx.paymentIntent.findFirst({
            where: { tenantId, orderId, status: client_1.PaymentIntentStatus.OPEN },
            orderBy: { createdAt: 'desc' },
        });
        if (!openIntent)
            return;
        const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
        if (!order)
            return;
        const capturedAgg = await tx.payment.aggregate({
            where: { tenantId, orderId, status: client_1.PaymentStatus.CAPTURED },
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
                data: { status: client_1.PaymentIntentStatus.COMPLETED },
            });
        }
    }
};
exports.PaymentIntentsService = PaymentIntentsService;
exports.PaymentIntentsService = PaymentIntentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentIntentsService);
