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
exports.CashService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const cash_permissions_1 = require("./policies/cash.permissions");
let CashService = class CashService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    q2(v) {
        return new library_1.Decimal(v).toDecimalPlaces(2);
    }
    // ---------- Queries ----------
    async listSessions(tenantId, q) {
        const { status, from, to, stationId, openedBy, page = 1, pageSize = 20, } = q;
        const where = { tenantId };
        if (status)
            where.status = status;
        if (stationId)
            where.stationId = stationId;
        if (openedBy)
            where.openedByUserId = openedBy;
        if (from || to) {
            where.openedAt = {};
            if (from)
                where.openedAt.gte = new Date(from);
            if (to)
                where.openedAt.lte = new Date(to);
        }
        const skip = (Number(page) - 1) * Number(pageSize);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.cashSession.findMany({
                where,
                orderBy: { openedAt: "desc" },
                skip,
                take: Number(pageSize),
            }),
            this.prisma.cashSession.count({ where }),
        ]);
        return { items, page: Number(page), pageSize: Number(pageSize), total };
    }
    async getOpenSession(tenantId, stationId) {
        if (!stationId)
            throw new common_1.BadRequestException("stationId é obrigatório (query ou X-Station-Id).");
        const s = await this.prisma.cashSession.findFirst({
            where: { tenantId, stationId, status: "OPEN" },
        });
        if (!s)
            throw new common_1.NotFoundException("Nenhuma sessão aberta encontrada para a estação.");
        return s;
    }
    async getSessionDetail(tenantId, sessionId) {
        const s = await this.prisma.cashSession.findFirst({
            where: { id: sessionId, tenantId },
            include: {
                movements: true,
                counts: true,
                payments: {
                    select: {
                        id: true,
                        method: true,
                        amount: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!s)
            throw new common_1.NotFoundException("Sessão não encontrada.");
        return s;
    }
    // ---------- Commands ----------
    async openSession(args) {
        const { tenantId, stationId, openingFloat, notes, userId } = args;
        if (!stationId)
            throw new common_1.BadRequestException("stationId é obrigatório.");
        const exists = await this.prisma.cashSession.findFirst({
            where: { tenantId, stationId, status: "OPEN" },
        });
        if (exists)
            throw new common_1.ConflictException("Já existe uma sessão aberta para esta estação.");
        const created = await this.prisma.cashSession.create({
            data: {
                tenantId,
                stationId,
                openedByUserId: userId,
                openingFloat,
                totalsByMethod: {},
                paymentsCount: {},
                status: "OPEN",
                notes,
            },
        });
        // this.webhooks?.emit('cash.opened', { tenantId, sessionId: created.id, stationId });
        return created;
    }
    async createMovement(args) {
        const { tenantId, sessionId, type, method, amount, reason, userId } = args;
        if (method !== "CASH")
            throw new common_1.BadRequestException("Movimentações de caixa aceitam apenas method=CASH.");
        const session = await this.prisma.cashSession.findFirst({
            where: { id: sessionId, tenantId },
        });
        if (!session)
            throw new common_1.NotFoundException("Sessão não encontrada.");
        if (session.status !== "OPEN")
            throw new common_1.ConflictException("Apenas sessões abertas aceitam movimentações.");
        const amt = this.q2(amount);
        const mov = await this.prisma.cashMovement.create({
            data: {
                tenantId,
                sessionId,
                type,
                method: "CASH",
                amount: amt,
                reason,
                createdByUserId: userId,
            },
        });
        // this.webhooks?.emit('cash.movement.created', { tenantId, sessionId, movementId: mov.id, type, amount: amt.toString() });
        return mov;
    }
    async createCount(args) {
        const { tenantId, sessionId, kind, denominations, total, userId } = args;
        const session = await this.prisma.cashSession.findFirst({
            where: { id: sessionId, tenantId },
        });
        if (!session)
            throw new common_1.NotFoundException("Sessão não encontrada.");
        if (session.status !== "OPEN")
            throw new common_1.ConflictException("Apenas sessões abertas aceitam contagens.");
        const count = await this.prisma.cashCount.create({
            data: {
                tenantId,
                sessionId,
                kind,
                denominations,
                total: this.q2(total),
                countedByUserId: userId,
            },
        });
        // this.webhooks?.emit('cash.count.created', { tenantId, sessionId, countId: count.id, kind, total: count.total.toString() });
        return count;
    }
    async reassignPayment(args) {
        const { tenantId, sessionId, paymentId } = args;
        const [session, payment] = await this.prisma.$transaction([
            this.prisma.cashSession.findFirst({
                where: { id: sessionId, tenantId, status: "OPEN" },
            }),
            this.prisma.payment.findFirst({ where: { id: paymentId, tenantId } }),
        ]);
        if (!session)
            throw new common_1.ConflictException("Sessão alvo deve estar OPEN no mesmo tenant.");
        if (!payment)
            throw new common_1.NotFoundException("Pagamento não encontrado neste tenant.");
        // Ajuste conforme seu enum/status de pagamento elegível
        if (["CANCELED", "REFUNDED"].includes(payment.status)) {
            throw new common_1.ConflictException("Pagamento não elegível para reatribuição.");
        }
        const updated = await this.prisma.payment.update({
            where: { id: paymentId },
            data: { sessionId: session.id },
        });
        return { ok: true, paymentId: updated.id, sessionId: session.id };
    }
    async closeSession(args) {
        const { tenantId, sessionId, note } = args;
        const session = await this.prisma.cashSession.findFirst({
            where: { id: sessionId, tenantId },
        });
        if (!session)
            throw new common_1.NotFoundException("Sessão não encontrada.");
        if (session.status !== "OPEN")
            throw new common_1.ConflictException("Sessão já está fechada.");
        // Pagamentos por método
        const payments = await this.prisma.payment.findMany({
            where: { tenantId, sessionId },
            select: { method: true, amount: true },
        });
        const byMethod = payments.reduce((acc, p) => {
            const key = p.method;
            acc[key] = (acc[key] ?? this.q2(0)).plus(this.q2(p.amount));
            return acc;
        }, {});
        const paymentsCount = {};
        for (const m of Object.keys(byMethod)) {
            paymentsCount[m] = payments.filter((p) => p.method === m).length;
        }
        paymentsCount.total = payments.length;
        const sumMov = async (type) => {
            const rows = await this.prisma.cashMovement.findMany({
                where: { tenantId, sessionId, type },
            });
            return rows.reduce((acc, r) => acc.plus(r.amount), this.q2(0));
        };
        const suprimentos = await sumMov("SUPRIMENTO");
        const sangrias = await sumMov("SANGRIA");
        const openingCash = new library_1.Decimal(session.openingFloat?.CASH ?? 0);
        const cashCaptured = byMethod["CASH"] ?? this.q2(0);
        const cashExpected = openingCash
            .plus(suprimentos)
            .minus(sangrias)
            .plus(cashCaptured);
        const finalCount = await this.prisma.cashCount.findFirst({
            where: { tenantId, sessionId, kind: "FINAL" },
            orderBy: { createdAt: "desc" },
        });
        const cashCountedFinal = finalCount ? finalCount.total : null;
        const cashDelta = cashCountedFinal
            ? cashCountedFinal.minus(cashExpected)
            : null;
        const updated = await this.prisma.cashSession.update({
            where: { id: sessionId },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                notes: note ?? undefined,
                totalsByMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, v.toString()])),
                paymentsCount,
            },
        });
        const summary = {
            totalsByMethod: updated.totalsByMethod,
            cashExpected: cashExpected.toString(),
            cashCountedFinal: cashCountedFinal ? cashCountedFinal.toString() : null,
            cashDelta: cashDelta ? cashDelta.toString() : null,
            movements: {
                SUPRIMENTO: suprimentos.toString(),
                SANGRIA: sangrias.toString(),
            },
            payments: {
                count: payments.length,
                byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, v.toString()])),
            },
        };
        // this.webhooks?.emit('cash.closed', { tenantId, sessionId, summary });
        return summary;
    }
    async reopenSession(args) {
        // Recupere roles do request/context conforme seu projeto (ex.: via RequestContext)
        const systemRole = global.requestContext?.systemRole ?? "NONE";
        const tenantRole = global.requestContext?.tenantRole ?? "USER";
        if (!(0, cash_permissions_1.canCloseOrReopen)(systemRole, tenantRole)) {
            throw new common_1.ForbiddenException("Acesso negado para reabrir sessão.");
        }
        const s = await this.prisma.cashSession.findFirst({
            where: { id: args.sessionId, tenantId: args.tenantId },
        });
        if (!s)
            throw new common_1.NotFoundException("Sessão não encontrada.");
        if (s.status !== "CLOSED")
            throw new common_1.ConflictException("Somente sessões CLOSED podem ser reabertas.");
        const openExists = await this.prisma.cashSession.findFirst({
            where: {
                tenantId: args.tenantId,
                stationId: s.stationId,
                status: "OPEN",
            },
        });
        if (openExists)
            throw new common_1.ConflictException("Já existe sessão OPEN para esta estação.");
        const updated = await this.prisma.cashSession.update({
            where: { id: args.sessionId },
            data: {
                status: "OPEN",
                closedAt: null,
                notes: s.notes
                    ? `${s.notes}\n[reopen]: ${args.reason}`
                    : `[reopen]: ${args.reason}`,
            },
        });
        // this.webhooks?.emit('cash.reopened', { tenantId: args.tenantId, sessionId: updated.id, reason: args.reason });
        return updated;
    }
    // ---------- Relatórios ----------
    async reportDaily(tenantId, yyyyMMdd) {
        const start = new Date(`${yyyyMMdd}T00:00:00.000Z`);
        const end = new Date(`${yyyyMMdd}T23:59:59.999Z`);
        const sessions = await this.prisma.cashSession.findMany({
            where: { tenantId, openedAt: { gte: start, lte: end } },
        });
        const sum = {};
        for (const s of sessions) {
            const t = s.totalsByMethod;
            if (t) {
                for (const [m, v] of Object.entries(t)) {
                    sum[m] = (sum[m] ?? this.q2(0)).plus(this.q2(v));
                }
            }
        }
        return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v.toString()]));
    }
    async exportSessions(tenantId, q) {
        const { from, to, stationId } = q;
        const where = { tenantId };
        if (stationId)
            where.stationId = stationId;
        if (from || to) {
            where.openedAt = {};
            if (from)
                where.openedAt.gte = new Date(from);
            if (to)
                where.openedAt.lte = new Date(to);
        }
        const rows = await this.prisma.cashSession.findMany({
            where,
            orderBy: { openedAt: "desc" },
        });
        return { items: rows, format: q.format ?? "json" };
    }
    // ---------- Integração com Payments ----------
    // Chame isso no fluxo de captura (PaymentsService) usando header X-Station-Id
    async tryAttachPaymentToOpenSession(tenantId, paymentId, stationId) {
        if (!stationId)
            return;
        const open = await this.prisma.cashSession.findFirst({
            where: { tenantId, stationId, status: "OPEN" },
        });
        if (!open)
            return;
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: { sessionId: open.id },
        });
    }
};
exports.CashService = CashService;
exports.CashService = CashService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CashService);
