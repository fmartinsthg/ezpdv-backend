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
exports.KdsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const webhooks_service_1 = require("../webhooks/webhooks.service");
const cash_window_port_1 = require("./ports/cash-window.port");
const kds_bus_1 = require("./kds.bus"); // 👈 SSE bus
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 50;
let KdsService = class KdsService {
    constructor(prisma, webhooks, cash, bus // 👈 injeta o bus
    ) {
        this.prisma = prisma;
        this.webhooks = webhooks;
        this.cash = cash;
        this.bus = bus;
    }
    /* -------------------------- helpers -------------------------- */
    pg({ page, pageSize }) {
        const p = page ?? DEFAULT_PAGE;
        const s = pageSize ?? DEFAULT_SIZE;
        return { skip: (p - 1) * s, take: s, page: p, pageSize: s };
    }
    /** Aceita 5, "5", W/"5". Retorna número inteiro ou null se não enviado. */
    parseIfMatch(ifMatch) {
        if (!ifMatch)
            return null;
        const cleaned = String(ifMatch)
            .trim()
            .replace(/^W\/"?/, "")
            .replace(/"$/, "");
        const n = Number(cleaned);
        return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    async withCashWindow(tenantId, base) {
        const win = await this.cash.getCurrentWindow(tenantId);
        if (!win?.from)
            return base;
        return {
            ...base,
            order: {
                ...base.order,
                tenantId,
                createdAt: { gte: win.from, ...(win.to ? { lte: win.to } : {}) },
            },
        };
    }
    async listTickets(tenantId, station, status = client_1.OrderItemStatus.FIRED, sinceOrOpts, maybeOpts) {
        let sinceISO;
        let opts;
        if (typeof sinceOrOpts === "string" || sinceOrOpts === undefined) {
            sinceISO = sinceOrOpts;
            opts = maybeOpts;
        }
        else {
            // chamada sem sinceISO: 4º argumento é o objeto de paginação
            sinceISO = undefined;
            opts = sinceOrOpts;
        }
        const { skip, take, page, pageSize } = this.pg(opts ?? {});
        const since = sinceISO ? new Date(sinceISO) : undefined;
        const stationEnum = String(station).toUpperCase();
        const statusEnum = String(status).toUpperCase();
        let where = {
            tenantId,
            station: stationEnum,
            status: statusEnum,
            firedAt: { not: null },
            voidedAt: null,
            order: { tenantId, status: client_1.OrderStatus.OPEN },
            ...(since ? { updatedAt: { gte: since } } : {}),
        };
        where = await this.withCashWindow(tenantId, where);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.orderItem.findMany({
                where,
                orderBy: [{ firedAt: "asc" }, { createdAt: "asc" }], // FIFO
                skip,
                take,
                include: {
                    order: {
                        select: {
                            id: true,
                            status: true,
                            version: true,
                            createdAt: true,
                            tabNumber: true,
                        },
                    },
                    product: { select: { id: true, name: true } },
                },
            }),
            this.prisma.orderItem.count({ where }),
        ]);
        const ticketsMap = new Map();
        for (const it of items) {
            const o = it.order;
            if (!ticketsMap.has(o.id)) {
                ticketsMap.set(o.id, {
                    orderId: o.id,
                    tableNumber: o.tabNumber ?? undefined,
                    status: o.status,
                    version: o.version,
                    createdAt: o.createdAt,
                    items: [],
                });
            }
            ticketsMap.get(o.id).items.push({
                id: it.id,
                productId: it.productId,
                productName: it.product?.name,
                qty: it.quantity,
                status: it.status,
                station: it.station,
                notes: it.notes,
                firedAt: it.firedAt,
                updatedAt: it.updatedAt,
            });
        }
        return { items: Array.from(ticketsMap.values()), total, page, pageSize };
    }
    async listItems(tenantId, station, status = client_1.OrderItemStatus.FIRED, sinceOrOpts, maybeOpts) {
        let sinceISO;
        let opts;
        if (typeof sinceOrOpts === "string" || sinceOrOpts === undefined) {
            sinceISO = sinceOrOpts;
            opts = maybeOpts;
        }
        else {
            sinceISO = undefined;
            opts = sinceOrOpts;
        }
        const { skip, take, page, pageSize } = this.pg(opts ?? {});
        const since = sinceISO ? new Date(sinceISO) : undefined;
        const stationEnum = String(station).toUpperCase();
        const statusEnum = String(status).toUpperCase();
        let where = {
            tenantId,
            station: stationEnum,
            status: statusEnum,
            firedAt: { not: null },
            voidedAt: null,
            order: { tenantId, status: client_1.OrderStatus.OPEN },
            ...(since ? { updatedAt: { gte: since } } : {}),
        };
        where = await this.withCashWindow(tenantId, where);
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.orderItem.findMany({
                where,
                orderBy: [{ firedAt: "asc" }, { createdAt: "asc" }], // FIFO
                skip,
                take,
                include: {
                    order: { select: { id: true, tabNumber: true } },
                    product: { select: { id: true, name: true } },
                },
            }),
            this.prisma.orderItem.count({ where }),
        ]);
        const items = rows.map((it) => ({
            id: it.id,
            orderId: it.orderId,
            tableNumber: it.order?.tabNumber ?? undefined,
            productId: it.productId,
            productName: it.product?.name,
            qty: it.quantity,
            status: it.status,
            station: it.station,
            notes: it.notes,
            firedAt: it.firedAt,
            updatedAt: it.updatedAt,
        }));
        return { items, total, page, pageSize };
    }
    /* -------------------------- commands -------------------------- */
    async completeItem(tenantId, itemId, actorUserId) {
        const item = await this.prisma.orderItem.findFirst({
            where: { id: itemId, tenantId, voidedAt: null },
            select: { id: true, status: true, orderId: true, station: true },
        });
        if (!item)
            throw new common_1.NotFoundException("Item não encontrado");
        if (item.status === client_1.OrderItemStatus.CLOSED) {
            return { itemId, status: item.status, alreadyClosed: true };
        }
        if (item.status !== client_1.OrderItemStatus.FIRED) {
            throw new common_1.BadRequestException("Item não está em estado FIRED");
        }
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx) => {
            const up = await tx.orderItem.update({
                where: { id: itemId },
                data: { status: client_1.OrderItemStatus.CLOSED, closedAt: now },
                select: { id: true, orderId: true, status: true, station: true },
            });
            await tx.orderItemEvent.create({
                data: {
                    tenantId,
                    orderItemId: itemId,
                    userId: actorUserId,
                    eventType: "STATUS_CHANGE",
                    fromStatus: client_1.OrderItemStatus.FIRED,
                    toStatus: client_1.OrderItemStatus.CLOSED,
                    reason: "KDS.complete",
                },
            });
            await tx.orderEvent.create({
                data: {
                    tenantId,
                    orderId: up.orderId,
                    userId: actorUserId,
                    eventType: "ITEM_CLOSED",
                    reason: `KDS.complete:${up.id}`,
                },
            });
            return up;
        });
        // SSE: notifica item.closed
        this.bus.publish({
            type: "item.closed",
            tenantId,
            orderId: updated.orderId,
            itemId: updated.id,
            station: (item.station ??
                updated.station ??
                client_1.PrepStation.KITCHEN),
            at: now.toISOString(),
        });
        // webhook (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.item.closed", { orderId: updated.orderId, itemId: updated.id, by: "KDS" }, { deliverNow: true });
        }
        catch (_) { }
        return { itemId: updated.id, status: updated.status, alreadyClosed: false };
    }
    async bulkComplete(tenantId, itemIds, actorUserId) {
        if (!itemIds?.length)
            return { affected: 0 };
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx) => {
            const items = await tx.orderItem.findMany({
                where: {
                    tenantId,
                    id: { in: itemIds },
                    status: client_1.OrderItemStatus.FIRED,
                    voidedAt: null,
                },
                select: { id: true, orderId: true, station: true }, // 👈 pega station para SSE
            });
            if (items.length === 0)
                return { affected: 0, perOrder: {} };
            await tx.orderItem.updateMany({
                where: {
                    tenantId,
                    id: { in: items.map((i) => i.id) },
                    status: client_1.OrderItemStatus.FIRED,
                    voidedAt: null,
                },
                data: { status: client_1.OrderItemStatus.CLOSED, closedAt: now },
            });
            for (const it of items) {
                await tx.orderItemEvent.create({
                    data: {
                        tenantId,
                        orderItemId: it.id,
                        userId: actorUserId,
                        eventType: "STATUS_CHANGE",
                        fromStatus: client_1.OrderItemStatus.FIRED,
                        toStatus: client_1.OrderItemStatus.CLOSED,
                        reason: "KDS.bulkComplete",
                    },
                });
            }
            const perOrder = {};
            for (const it of items)
                perOrder[it.orderId] = (perOrder[it.orderId] ?? 0) + 1;
            for (const [orderId, count] of Object.entries(perOrder)) {
                await tx.orderEvent.create({
                    data: {
                        tenantId,
                        orderId,
                        userId: actorUserId,
                        eventType: "KDS_BULK_COMPLETE",
                        reason: `count=${count}`,
                    },
                });
            }
            return { affected: items.length, perOrder, items };
        });
        // SSE: notifica vários item.closed
        for (const it of updated.items ?? []) {
            this.bus.publish({
                type: "item.closed",
                tenantId,
                orderId: it.orderId,
                itemId: it.id,
                station: (it.station ?? client_1.PrepStation.KITCHEN),
                at: now.toISOString(),
            });
        }
        // webhook (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.kds.bulk_closed", { affected: updated.affected }, { deliverNow: true });
        }
        catch (_) { }
        // remove `items` do payload externo
        const { items, ...rest } = updated;
        return rest;
    }
    async bumpTicket(tenantId, orderId, ifMatch, actorUserId) {
        const expected = this.parseIfMatch(ifMatch);
        if (expected == null) {
            throw new common_1.HttpException("If-Match obrigatório para bump do ticket", 428);
        }
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, tenantId, status: client_1.OrderStatus.OPEN },
            select: { id: true, version: true },
        });
        if (!order)
            throw new common_1.NotFoundException("Ticket não encontrado");
        if (order.version !== expected) {
            throw new common_1.PreconditionFailedException("Versão divergente (If-Match inválido)");
        }
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx) => {
            const items = await tx.orderItem.findMany({
                where: {
                    tenantId,
                    orderId,
                    status: client_1.OrderItemStatus.FIRED,
                    voidedAt: null,
                },
                select: { id: true },
            });
            if (items.length === 0)
                return { orderVersion: order.version, affected: 0 };
            await tx.orderItem.updateMany({
                where: {
                    tenantId,
                    orderId,
                    status: client_1.OrderItemStatus.FIRED,
                    voidedAt: null,
                },
                data: { status: client_1.OrderItemStatus.CLOSED, closedAt: now },
            });
            await tx.orderEvent.create({
                data: {
                    tenantId,
                    orderId,
                    userId: actorUserId,
                    eventType: "KDS_BUMP",
                    reason: `count=${items.length}`,
                },
            });
            for (const it of items) {
                await tx.orderItemEvent.create({
                    data: {
                        tenantId,
                        orderItemId: it.id,
                        userId: actorUserId,
                        eventType: "STATUS_CHANGE",
                        fromStatus: client_1.OrderItemStatus.FIRED,
                        toStatus: client_1.OrderItemStatus.CLOSED,
                        reason: "KDS.bump",
                    },
                });
            }
            return { orderVersion: order.version, affected: items.length };
        });
        // SSE: notifica ticket.bumped
        this.bus.publish({
            type: "ticket.bumped",
            tenantId,
            orderId,
            affected: updated.affected,
            at: now.toISOString(),
        });
        // webhook (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.kds.bumped", { orderId, affected: updated.affected }, { deliverNow: true });
        }
        catch (_) { }
        return updated;
    }
    async recallTicket(tenantId, orderId, actorUserId) {
        const closed = await this.prisma.orderItem.findMany({
            where: {
                tenantId,
                orderId,
                status: client_1.OrderItemStatus.CLOSED,
                voidedAt: null,
            },
            select: { id: true, station: true }, // 👈 pega station para SSE de item.fired
        });
        if (closed.length === 0)
            return { affected: 0 };
        const res = await this.prisma.$transaction(async (tx) => {
            await tx.orderItem.updateMany({
                where: {
                    tenantId,
                    orderId,
                    status: client_1.OrderItemStatus.CLOSED,
                    voidedAt: null,
                },
                data: { status: client_1.OrderItemStatus.FIRED, closedAt: null },
            });
            await tx.orderEvent.create({
                data: {
                    tenantId,
                    orderId,
                    userId: actorUserId,
                    eventType: "KDS_RECALL",
                    reason: `count=${closed.length}`,
                },
            });
            for (const it of closed) {
                await tx.orderItemEvent.create({
                    data: {
                        tenantId,
                        orderItemId: it.id,
                        userId: actorUserId,
                        eventType: "STATUS_CHANGE",
                        fromStatus: client_1.OrderItemStatus.CLOSED,
                        toStatus: client_1.OrderItemStatus.FIRED,
                        reason: "KDS.recall",
                    },
                });
            }
            return { affected: closed.length };
        });
        const now = new Date();
        // SSE: notifica ticket.recalled
        this.bus.publish({
            type: "ticket.recalled",
            tenantId,
            orderId,
            affected: res.affected,
            at: now.toISOString(),
        });
        // (opcional) também emitir item.fired para cada item reaberto
        for (const it of closed) {
            this.bus.publish({
                type: "item.fired",
                tenantId,
                orderId,
                itemId: it.id,
                station: (it.station ?? client_1.PrepStation.KITCHEN),
                at: now.toISOString(),
            });
        }
        // webhook (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.kds.recalled", { orderId, affected: res.affected }, { deliverNow: true });
        }
        catch (_) { }
        return res;
    }
};
exports.KdsService = KdsService;
exports.KdsService = KdsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        webhooks_service_1.WebhooksService,
        cash_window_port_1.CashWindowPort,
        kds_bus_1.KdsBus // 👈 injeta o bus
    ])
], KdsService);
