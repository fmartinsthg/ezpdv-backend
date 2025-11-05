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
const client_1 = require("@prisma/client");
const cash_permissions_1 = require("./policies/cash.permissions");
// Política padrão: UMA sessão OPEN por tenant (global).
// Você pode flexibilizar via env se quiser manter multiestação temporariamente.
const CASH_SINGLE_SESSION = (process.env.CASH_SINGLE_SESSION ?? "true").toLowerCase() !== "false";
let CashService = class CashService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    q2(v) {
        return new library_1.Decimal(v).toDecimalPlaces(2);
    }
    fmt2(v) {
        return new library_1.Decimal(v).toDecimalPlaces(2).toFixed(2);
    }
    normalizeMoneyJson(obj = {}) {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = this.fmt2(v);
        }
        return out;
    }
    // ---------- Helpers de política ----------
    /** Indica se existe QUALQUER sessão OPEN no tenant (globalmente). */
    async hasAnyOpenSession(tenantId) {
        const count = await this.prisma.cashSession.count({
            where: { tenantId, status: "OPEN" },
        });
        return count > 0;
    }
    /** Retorna a sessão OPEN mais recente do tenant ou lança NotFound. */
    async getTenantOpenSessionOrFail(tenantId) {
        const s = await this.prisma.cashSession.findFirst({
            where: { tenantId, status: "OPEN" },
            orderBy: { openedAt: "desc" },
        });
        if (!s)
            throw new common_1.NotFoundException("Nenhuma sessão aberta no tenant.");
        return s;
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
    /**
     * Busca sessão OPEN.
     * - Se stationId for enviado, filtra por estação (comportamento antigo).
     * - Se não for enviado, retorna a sessão OPEN mais recente do tenant (escopo global).
     */
    async getOpenSession(tenantId, stationId) {
        if (stationId) {
            const s = await this.prisma.cashSession.findFirst({
                where: { tenantId, stationId, status: "OPEN" },
            });
            if (!s)
                throw new common_1.NotFoundException("Nenhuma sessão aberta encontrada para a estação.");
            return s;
        }
        // Tenant-level (global)
        const s = await this.prisma.cashSession.findFirst({
            where: { tenantId, status: "OPEN" },
            orderBy: { openedAt: "desc" },
        });
        if (!s)
            throw new common_1.NotFoundException("Nenhuma sessão aberta encontrada no tenant.");
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
        // Política: preferimos um identificador estável se o cliente não enviar.
        const effectiveStation = stationId?.trim() || "GLOBAL";
        if (CASH_SINGLE_SESSION) {
            // Bloqueia qualquer segunda sessão OPEN no tenant.
            const already = await this.hasAnyOpenSession(tenantId);
            if (already) {
                throw new common_1.ConflictException("Já existe uma sessão aberta para este tenant.");
            }
        }
        try {
            const created = await this.prisma.cashSession.create({
                data: {
                    tenantId,
                    stationId: effectiveStation,
                    openedByUserId: userId,
                    openingFloat: this.normalizeMoneyJson(openingFloat),
                    totalsByMethod: {},
                    paymentsCount: {},
                    status: "OPEN",
                    notes,
                    // Mantém sua sentinela para UNIQUE (tenantId, openStationKey),
                    // mas agora o valor default será "GLOBAL" quando não informado.
                    openStationKey: effectiveStation,
                },
            });
            return created;
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === "P2002") {
                // violação de unique (tenantId, openStationKey)
                // Com CASH_SINGLE_SESSION=true, isso funciona como trava adicional.
                throw new common_1.ConflictException("Já existe uma sessão aberta (conflito de estação).");
            }
            throw e;
        }
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
        if (["CANCELED", "REFUNDED"].includes(payment.status)) {
            throw new common_1.ConflictException("Pagamento não elegível para reatribuição.");
        }
        // Idempotente: se já estiver na sessão, não muda.
        if (payment.sessionId === session.id) {
            return { ok: true, paymentId: payment.id, sessionId: session.id };
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
        const openingCash = this.q2(session.openingFloat?.CASH ?? 0);
        const cashCaptured = byMethod["CASH"] ?? this.q2(0);
        const cashExpected = openingCash
            .plus(suprimentos)
            .minus(sangrias)
            .plus(cashCaptured);
        const finalCount = await this.prisma.cashCount.findFirst({
            where: { tenantId, sessionId, kind: "FINAL" },
            orderBy: { createdAt: "desc" },
        });
        const cashCountedFinal = finalCount ? this.q2(finalCount.total) : null;
        const cashDelta = cashCountedFinal
            ? cashCountedFinal.minus(cashExpected)
            : null;
        const updated = await this.prisma.cashSession.update({
            where: { id: sessionId },
            data: {
                status: "CLOSED",
                closedAt: new Date(),
                notes: note ?? undefined,
                totalsByMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, this.fmt2(v)])),
                paymentsCount,
                openStationKey: null, // libera a vaga para nova OPEN
            },
        });
        const summary = {
            totalsByMethod: updated.totalsByMethod,
            cashExpected: this.fmt2(cashExpected),
            cashCountedFinal: cashCountedFinal ? this.fmt2(cashCountedFinal) : null,
            cashDelta: cashDelta ? this.fmt2(cashDelta) : null,
            movements: {
                SUPRIMENTO: this.fmt2(suprimentos),
                SANGRIA: this.fmt2(sangrias),
            },
            payments: {
                count: payments.length,
                byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, this.fmt2(v)])),
            },
        };
        return summary;
    }
    async reopenSession(args) {
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
        if (CASH_SINGLE_SESSION) {
            // Garante que não haverá duas OPEN ao reabrir
            const already = await this.hasAnyOpenSession(args.tenantId);
            if (already) {
                throw new common_1.ConflictException("Já existe sessão OPEN para este tenant. Feche-a antes de reabrir.");
            }
        }
        try {
            const updated = await this.prisma.cashSession.update({
                where: { id: args.sessionId },
                data: {
                    status: "OPEN",
                    closedAt: null,
                    notes: s.notes
                        ? `${s.notes}\n[reopen]: ${args.reason}`
                        : `[reopen]: ${args.reason}`,
                    // mantém a mesma estação que foi aberta; em modo single-session
                    // não importa, pois trava pela verificação global acima
                    openStationKey: s.stationId,
                },
            });
            return updated;
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === "P2002") {
                throw new common_1.ConflictException("Conflito com sessão OPEN existente.");
            }
            throw e;
        }
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
        return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, this.fmt2(v)]));
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
    /**
     * Vincula pagamento à sessão OPEN.
     * - Se stationId vier, tenta primeiro por estação.
     * - Independentemente disso, garante vínculo à sessão OPEN do tenant (mais recente).
     * - Idempotente: não reatribui se o pagamento já possui sessionId.
     */
    async tryAttachPaymentToOpenSession(tenantId, paymentId, stationId) {
        const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, tenantId },
            select: { id: true, sessionId: true },
        });
        if (!payment)
            return;
        // Se já estiver vinculado, não faz nada (idempotente).
        if (payment.sessionId)
            return;
        // 1) Preferência pela estação (se informada e tiver sessão OPEN).
        if (stationId) {
            const byStation = await this.prisma.cashSession.findFirst({
                where: { tenantId, stationId, status: "OPEN" },
            });
            if (byStation) {
                await this.prisma.payment.update({
                    where: { id: paymentId },
                    data: { sessionId: byStation.id },
                });
                return;
            }
        }
        // 2) Fallback: vincular à sessão OPEN mais recente do tenant.
        const anyOpen = await this.prisma.cashSession.findFirst({
            where: { tenantId, status: "OPEN" },
            orderBy: { openedAt: "desc" },
        });
        if (!anyOpen)
            return; // Guard na rota de payments já impede este caso
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: { sessionId: anyOpen.id },
        });
    }
};
exports.CashService = CashService;
exports.CashService = CashService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CashService);
