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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const webhooks_service_1 = require("../webhooks/webhooks.service");
const kds_bus_1 = require("../kds/kds.bus"); // 👈 SSE bus
const MAX_RETRIES = 3;
let OrdersService = OrdersService_1 = class OrdersService {
    constructor(prisma, jwtService, webhooks, bus // 👈 injeta o bus
    ) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.webhooks = webhooks;
        this.bus = bus;
        this.logger = new common_1.Logger(OrdersService_1.name);
    }
    /* -------------------------- If-Match helpers -------------------------- */
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
    /** Confere If-Match com a versão atual da ordem. Lança 412 se divergir. */
    async assertIfMatch(tenantId, orderId, ifMatch) {
        const expected = this.parseIfMatch(ifMatch);
        if (expected == null)
            return; // header não enviado -> não valida
        const row = await this.prisma.order.findFirst({
            where: { id: orderId, tenantId },
            select: { version: true },
        });
        if (!row)
            throw new common_1.NotFoundException("Comanda não encontrada.");
        if (row.version !== expected) {
            throw new common_1.PreconditionFailedException(`If-Match falhou: versão atual é ${row.version}, esperada ${expected}.`);
        }
    }
    /* -------------------------- Utils -------------------------- */
    toDecimal(n, fallback = 0) {
        if (n === undefined || n === null)
            return new client_1.Prisma.Decimal(fallback);
        return new client_1.Prisma.Decimal(typeof n === "string" ? n : n.toString());
    }
    async loadProductsMap(tenantId, productIds) {
        const products = await this.prisma.product.findMany({
            where: { tenantId, id: { in: productIds } },
            select: { id: true, price: true, isActive: true, prepStation: true },
        });
        return new Map(products.map((p) => [p.id, p]));
    }
    async assertOrderInTenant(tenantId, id) {
        const order = await this.prisma.order.findFirst({
            where: { id, tenantId },
        });
        if (!order)
            throw new common_1.NotFoundException("Comanda não encontrada.");
        return order;
    }
    async computeRequiredInventory(tenantId, items, tx) {
        const productIds = Array.from(new Set(items.map((i) => i.productId)));
        const recipes = await tx.recipe.findMany({
            where: { tenantId, productId: { in: productIds } },
            include: { lines: true },
        });
        const recipeByProduct = new Map(recipes.map((r) => [r.productId, r.lines]));
        const required = new Map();
        for (const it of items) {
            const lines = recipeByProduct.get(it.productId) || [];
            for (const line of lines) {
                const need = new client_1.Prisma.Decimal(line.qtyBase).times(it.quantity);
                const prev = required.get(line.inventoryItemId) || this.toDecimal(0);
                required.set(line.inventoryItemId, prev.plus(need));
            }
        }
        return required;
    }
    async checkAndDebitInventorySerializable(tenantId, orderId, required) {
        let attempt = 0;
        while (true) {
            try {
                return await this.prisma.$transaction(async (tx) => {
                    const invIds = Array.from(required.keys());
                    if (invIds.length === 0)
                        return;
                    const items = await tx.inventoryItem.findMany({
                        where: { tenantId, id: { in: invIds } },
                        select: { id: true, onHand: true },
                    });
                    for (const inv of items) {
                        const need = required.get(inv.id) || this.toDecimal(0);
                        if (new client_1.Prisma.Decimal(inv.onHand).lt(need)) {
                            throw new common_1.ConflictException("Estoque insuficiente para produção.");
                        }
                    }
                    for (const inv of items) {
                        const need = required.get(inv.id) || this.toDecimal(0);
                        if (need.eq(0))
                            continue;
                        const newOnHand = new client_1.Prisma.Decimal(inv.onHand).minus(need);
                        await tx.inventoryItem.update({
                            where: { id: inv.id },
                            data: { onHand: newOnHand },
                        });
                        await tx.stockMovement.create({
                            data: {
                                tenantId,
                                inventoryItemId: inv.id,
                                type: client_1.StockMovementType.SALE,
                                qtyDelta: need.negated(),
                                relatedOrderId: orderId,
                                reason: "ORDER_ITEM_FIRE",
                            },
                        });
                    }
                }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
            }
            catch (e) {
                if (e?.code === "P2034" ||
                    String(e?.message || "").includes("could not serialize access")) {
                    if (++attempt >= MAX_RETRIES)
                        throw e;
                    await new Promise((r) => setTimeout(r, 50 * attempt));
                    continue;
                }
                throw e;
            }
        }
    }
    async creditInventorySerializable(tenantId, orderId, toCredit) {
        let attempt = 0;
        while (true) {
            try {
                return await this.prisma.$transaction(async (tx) => {
                    const invIds = Array.from(toCredit.keys());
                    if (invIds.length === 0)
                        return;
                    const items = await tx.inventoryItem.findMany({
                        where: { tenantId, id: { in: invIds } },
                        select: { id: true, onHand: true },
                    });
                    for (const inv of items) {
                        const qty = toCredit.get(inv.id) || this.toDecimal(0);
                        if (qty.eq(0))
                            continue;
                        const newOnHand = new client_1.Prisma.Decimal(inv.onHand).plus(qty);
                        await tx.inventoryItem.update({
                            where: { id: inv.id },
                            data: { onHand: newOnHand },
                        });
                        await tx.stockMovement.create({
                            data: {
                                tenantId,
                                inventoryItemId: inv.id,
                                type: client_1.StockMovementType.ADJUSTMENT,
                                qtyDelta: qty,
                                relatedOrderId: orderId,
                                reason: "ORDER_ITEM_VOID_OR_CANCEL",
                            },
                        });
                    }
                }, { isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable });
            }
            catch (e) {
                if (e?.code === "P2034" ||
                    String(e?.message || "").includes("could not serialize access")) {
                    if (++attempt >= MAX_RETRIES)
                        throw e;
                    await new Promise((r) => setTimeout(r, 50 * attempt));
                    continue;
                }
                throw e;
            }
        }
    }
    /** Recalcula subtotal/total e incrementa a versão. */
    async recomputeOrderTotals(tenantId, orderId, db) {
        const client = (db ?? this.prisma);
        const sums = await client.orderItem.aggregate({
            where: {
                tenantId,
                orderId,
                status: {
                    in: [
                        client_1.OrderItemStatus.STAGED,
                        client_1.OrderItemStatus.FIRED,
                        client_1.OrderItemStatus.CLOSED,
                    ],
                },
            },
            _sum: { total: true },
        });
        const subtotal = new client_1.Prisma.Decimal(sums._sum.total || 0);
        const total = subtotal;
        await client.order.update({
            where: { id: orderId },
            data: {
                subtotal,
                discount: new client_1.Prisma.Decimal(0),
                total,
                version: { increment: 1 },
            },
        });
    }
    /* -------------------------- Use cases -------------------------- */
    async create(tenantId, user, dto, idempotencyKey) {
        if (idempotencyKey) {
            const existing = await this.prisma.order.findFirst({
                where: { tenantId, idempotencyKey },
                include: { items: true },
            });
            if (existing)
                return existing;
        }
        const prodIds = Array.from(new Set(dto.items.map((i) => i.productId)));
        const prodMap = await this.loadProductsMap(tenantId, prodIds);
        if (prodMap.size !== prodIds.length) {
            throw new common_1.NotFoundException("Produto(s) não encontrado(s) no tenant.");
        }
        let subtotal = new client_1.Prisma.Decimal(0);
        const itemsData = dto.items.map((it) => {
            const p = prodMap.get(it.productId);
            if (!p.isActive)
                throw new common_1.BadRequestException("Produto inativo.");
            const unitPrice = it.unitPrice !== undefined
                ? this.toDecimal(it.unitPrice)
                : new client_1.Prisma.Decimal(p.price);
            const qty = new client_1.Prisma.Decimal(it.quantity);
            if (unitPrice.lte(0))
                throw new common_1.BadRequestException("unitPrice deve ser maior que zero.");
            if (qty.lte(0))
                throw new common_1.BadRequestException("quantity deve ser maior que zero.");
            const totalItem = unitPrice.times(qty);
            subtotal = subtotal.plus(totalItem);
            return {
                tenantId,
                productId: it.productId,
                quantity: qty,
                unitPrice,
                total: totalItem,
                status: client_1.OrderItemStatus.STAGED,
                notes: it.notes,
            };
        });
        const total = subtotal;
        // cria a ordem (transação)
        const order = await this.prisma.$transaction(async (tx) => {
            const created = await tx.order.create({
                data: {
                    tenantId,
                    status: client_1.OrderStatus.OPEN,
                    tabNumber: dto.tabNumber,
                    subtotal,
                    discount: this.toDecimal(0),
                    total,
                    idempotencyKey: idempotencyKey || null,
                    createdByUserId: user.userId,
                    assignedToUserId: user.userId,
                    items: { create: itemsData },
                },
                include: { items: true },
            });
            // auditoria da criação
            await tx.orderEvent.create({
                data: {
                    tenantId,
                    orderId: created.id,
                    userId: user.userId,
                    eventType: "CREATED",
                    fromStatus: null,
                    toStatus: client_1.OrderStatus.OPEN,
                    reason: null,
                },
            });
            return created;
        });
        // webhook fora da transação
        try {
            await this.webhooks.queueEvent(tenantId, "order.created", {
                order: {
                    id: order.id,
                    status: order.status,
                    tabNumber: order.tabNumber,
                    subtotal: order.subtotal,
                    total: order.total,
                    isSettled: order.isSettled ?? false,
                    createdAt: order.createdAt,
                },
            }, { deliverNow: true });
        }
        catch (err) {
            this.logger.warn(`Falha ao enfileirar webhook order.created: ${String(err)}`);
        }
        return order;
    }
    async findAll(tenantId, user, query) {
        const { status, mine, q, page = 1, limit = 10 } = query;
        const take = Math.min(Number(limit) || 10, 100);
        const skip = (Number(page) - 1) * take;
        const where = { tenantId };
        if (status)
            where.status = status;
        if (q)
            where.tabNumber = { contains: q, mode: "insensitive" };
        if (String(mine).toLowerCase() === "true")
            where.assignedToUserId = user.userId;
        const [items, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take,
                select: {
                    id: true,
                    status: true,
                    tabNumber: true,
                    subtotal: true,
                    total: true,
                    createdAt: true,
                    updatedAt: true,
                    assignedToUserId: true,
                    _count: { select: { items: true } },
                },
            }),
            this.prisma.order.count({ where }),
        ]);
        return {
            items,
            page: Number(page),
            limit: take,
            total,
            totalPages: Math.ceil(total / take),
        };
    }
    async findOne(tenantId, id, opts) {
        const order = await this.prisma.order.findFirst({
            where: { id, tenantId },
            include: {
                items: true,
                ...(opts?.includePayments ? { payments: true } : {}),
            },
        });
        if (!order)
            throw new common_1.NotFoundException("Comanda não encontrada.");
        return order;
    }
    async appendItems(tenantId, user, orderId, dto, ifMatch) {
        await this.assertIfMatch(tenantId, orderId, ifMatch);
        const order = await this.assertOrderInTenant(tenantId, orderId);
        if (order.status !== client_1.OrderStatus.OPEN) {
            throw new common_1.BadRequestException("Somente comandas OPEN podem receber novos itens.");
        }
        const prodIds = Array.from(new Set(dto.items.map((i) => i.productId)));
        const prodMap = await this.loadProductsMap(tenantId, prodIds);
        if (prodMap.size !== prodIds.length) {
            throw new common_1.NotFoundException("Produto(s) não encontrado(s) no tenant.");
        }
        const itemsData = dto.items.map((it) => {
            const p = prodMap.get(it.productId);
            if (!p.isActive)
                throw new common_1.BadRequestException("Produto inativo.");
            const unitPrice = it.unitPrice !== undefined
                ? this.toDecimal(it.unitPrice)
                : new client_1.Prisma.Decimal(p.price);
            const qty = new client_1.Prisma.Decimal(it.quantity);
            if (unitPrice.lte(0))
                throw new common_1.BadRequestException("unitPrice deve ser maior que zero.");
            if (qty.lte(0))
                throw new common_1.BadRequestException("quantity deve ser maior que zero.");
            const totalItem = unitPrice.times(qty);
            return {
                tenantId,
                orderId,
                productId: it.productId,
                quantity: qty,
                unitPrice,
                total: totalItem,
                status: client_1.OrderItemStatus.STAGED,
                notes: it.notes,
            };
        });
        await this.prisma.$transaction(async (tx) => {
            await tx.orderItem.createMany({ data: itemsData });
            const sums = await tx.orderItem.aggregate({
                where: {
                    orderId,
                    tenantId,
                    status: {
                        in: [
                            client_1.OrderItemStatus.STAGED,
                            client_1.OrderItemStatus.FIRED,
                            client_1.OrderItemStatus.CLOSED,
                        ],
                    },
                },
                _sum: { total: true },
            });
            const subtotal = new client_1.Prisma.Decimal(sums._sum.total || 0);
            const total = subtotal;
            await tx.order.update({
                where: { id: orderId },
                data: {
                    subtotal,
                    discount: this.toDecimal(0),
                    total,
                    assignedToUserId: user.userId,
                    version: { increment: 1 },
                },
            });
        });
        // evento opcional (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.items_appended", {
                orderId,
                appendedCount: dto.items.length,
            });
        }
        catch (e) {
            this.logger.warn(`Falha ao enfileirar webhook order.items_appended: ${String(e)}`);
        }
        return this.findOne(tenantId, orderId);
    }
    async fireItems(tenantId, user, orderId, dto, ifMatch) {
        await this.assertIfMatch(tenantId, orderId, ifMatch);
        const order = await this.assertOrderInTenant(tenantId, orderId);
        if (order.status !== client_1.OrderStatus.OPEN) {
            throw new common_1.BadRequestException("Apenas comandas OPEN podem disparar itens.");
        }
        const whereItems = {
            tenantId,
            orderId,
            status: client_1.OrderItemStatus.STAGED,
            ...(dto.itemIds?.length ? { id: { in: dto.itemIds } } : {}),
        };
        // Itens STAGED a disparar (já traz a prepStation do produto)
        const staged = await this.prisma.orderItem.findMany({
            where: whereItems,
            include: { product: { select: { prepStation: true } } },
        });
        if (staged.length === 0) {
            return this.findOne(tenantId, orderId);
        }
        // Calcula estoque a debitar
        const required = await this.computeRequiredInventory(tenantId, staged.map((s) => ({
            productId: s.productId,
            quantity: new client_1.Prisma.Decimal(s.quantity),
        })), this.prisma);
        await this.checkAndDebitInventorySerializable(tenantId, orderId, required);
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await Promise.all(staged.map((s) => tx.orderItem.update({
                where: { id: s.id },
                data: {
                    status: client_1.OrderItemStatus.FIRED,
                    station: s.product?.prepStation ?? client_1.PrepStation.KITCHEN,
                    firedAt: now,
                },
            })));
            await tx.orderItemEvent.createMany({
                data: staged.map((s) => ({
                    tenantId,
                    orderItemId: s.id,
                    userId: user.userId,
                    eventType: "STATUS_CHANGE",
                    fromStatus: client_1.OrderItemStatus.STAGED,
                    toStatus: client_1.OrderItemStatus.FIRED,
                    reason: `Fired at ${s.product?.prepStation ?? client_1.PrepStation.KITCHEN}`,
                })),
            });
            await tx.orderEvent.create({
                data: {
                    tenantId,
                    orderId,
                    userId: user.userId,
                    eventType: "ITEMS_FIRED",
                    reason: `${staged.length} item(ns) fired`,
                },
            });
            await tx.order.update({
                where: { id: orderId },
                data: { assignedToUserId: user.userId, version: { increment: 1 } },
            });
        });
        // SSE (fora da transação): emite item.fired por item
        for (const s of staged) {
            this.bus.publish({
                type: "item.fired",
                tenantId,
                orderId,
                itemId: s.id,
                station: (s.product?.prepStation ?? client_1.PrepStation.KITCHEN),
                at: now.toISOString(),
            });
        }
        // Webhook (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.items_fired", {
                orderId,
                itemIds: staged.map((s) => s.id),
                firedAt: now.toISOString(),
            }, { deliverNow: true });
        }
        catch (e) {
            this.logger.warn(`Falha ao enfileirar webhook order.items_fired: ${String(e)}`);
        }
        return this.findOne(tenantId, orderId);
    }
    async voidItem(tenantId, user, orderId, itemId, dto, approvalToken, ifMatch) {
        await this.assertIfMatch(tenantId, orderId, ifMatch);
        // valida aprovação
        let approver;
        try {
            const tokenStr = (approvalToken || "").replace(/^Bearer\s+/i, "");
            approver = this.jwtService.verify(tokenStr, {
                secret: process.env.JWT_SECRET || "ezpdv-secret",
            });
        }
        catch {
            throw new common_1.ForbiddenException("Token de aprovação inválido.");
        }
        const approverRoles = new Set();
        if (approver?.systemRole)
            approverRoles.add(String(approver.systemRole).toUpperCase());
        if (approver?.role)
            approverRoles.add(String(approver.role).toUpperCase());
        if (!["SUPERADMIN", "ADMIN", "MODERATOR"].some((r) => approverRoles.has(r))) {
            throw new common_1.ForbiddenException("Aprovação requer MODERATOR/ADMIN/SUPERADMIN.");
        }
        const item = await this.prisma.orderItem.findFirst({
            where: { id: itemId, orderId, tenantId },
            select: { id: true, status: true, productId: true, quantity: true },
        });
        if (!item)
            throw new common_1.NotFoundException("Item não encontrado.");
        if (item.status !== client_1.OrderItemStatus.FIRED) {
            throw new common_1.BadRequestException("Somente itens FIRED podem ser anulados (VOID).");
        }
        const toCredit = await this.computeRequiredInventory(tenantId, [
            {
                productId: item.productId,
                quantity: new client_1.Prisma.Decimal(item.quantity),
            },
        ], this.prisma);
        await this.creditInventorySerializable(tenantId, orderId, toCredit);
        await this.prisma.$transaction(async (tx) => {
            await tx.orderItem.update({
                where: { id: item.id },
                data: {
                    status: client_1.OrderItemStatus.VOID,
                    voidedAt: new Date(),
                    voidReason: dto.reason,
                    voidByUserId: user.userId,
                    voidApprovedBy: approver?.sub || null,
                },
            });
            // Auditoria do item VOID
            await tx.orderItemEvent.create({
                data: {
                    tenantId,
                    orderItemId: item.id,
                    userId: user.userId,
                    eventType: "STATUS_CHANGE",
                    fromStatus: client_1.OrderItemStatus.FIRED,
                    toStatus: client_1.OrderItemStatus.VOID,
                    reason: dto.reason ?? "VOID",
                },
            });
            await this.recomputeOrderTotals(tenantId, orderId, tx);
        });
        // evento (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.item_voided", {
                orderId,
                itemId: item.id,
            });
        }
        catch (e) {
            this.logger.warn(`Falha ao enfileirar webhook order.item_voided: ${String(e)}`);
        }
        return this.findOne(tenantId, orderId);
    }
    async cancel(tenantId, user, orderId, ifMatch) {
        await this.assertIfMatch(tenantId, orderId, ifMatch);
        const order = await this.assertOrderInTenant(tenantId, orderId);
        if (order.status !== client_1.OrderStatus.OPEN) {
            throw new common_1.BadRequestException("Somente comandas OPEN podem ser canceladas.");
        }
        const activeCount = await this.prisma.orderItem.count({
            where: {
                tenantId,
                orderId,
                status: { in: [client_1.OrderItemStatus.STAGED, client_1.OrderItemStatus.FIRED] },
            },
        });
        if (activeCount > 0) {
            throw new common_1.BadRequestException("Remova itens STAGED e faça VOID dos FIRED antes de cancelar a comanda.");
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: orderId },
                data: { status: client_1.OrderStatus.CANCELED, version: { increment: 1 } },
            });
            // Auditoria da ordem
            await tx.orderEvent.create({
                data: {
                    tenantId,
                    orderId,
                    userId: user.userId,
                    eventType: "STATUS_CHANGE",
                    fromStatus: client_1.OrderStatus.OPEN,
                    toStatus: client_1.OrderStatus.CANCELED,
                    reason: "Order canceled",
                },
            });
            await this.recomputeOrderTotals(tenantId, orderId, tx);
            return tx.order.findFirst({
                where: { id: orderId, tenantId },
                include: { items: true },
            });
        });
        // webhook (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.canceled", { orderId });
        }
        catch (e) {
            this.logger.warn(`Falha ao enfileirar webhook order.canceled: ${String(e)}`);
        }
        return updated;
    }
    async close(tenantId, user, orderId, _dto, ifMatch) {
        await this.assertIfMatch(tenantId, orderId, ifMatch);
        const order = await this.assertOrderInTenant(tenantId, orderId);
        if (order.status !== client_1.OrderStatus.OPEN) {
            throw new common_1.BadRequestException("Somente comandas OPEN podem ser fechadas.");
        }
        const staged = await this.prisma.orderItem.count({
            where: { tenantId, orderId, status: client_1.OrderItemStatus.STAGED },
        });
        if (staged > 0) {
            throw new common_1.BadRequestException("Há itens STAGED. Remova-os ou faça FIRE antes de fechar.");
        }
        const now = new Date();
        let affected = 0; // 👈 quantos FIRED serão fechados (para SSE)
        const result = await this.prisma.$transaction(async (tx) => {
            // Captura IDs dos itens FIRED antes de fechar (para auditoria)
            const firedItems = await tx.orderItem.findMany({
                where: { tenantId, orderId, status: client_1.OrderItemStatus.FIRED },
                select: { id: true },
            });
            affected = firedItems.length;
            // Fecha itens
            await tx.orderItem.updateMany({
                where: { tenantId, orderId, status: client_1.OrderItemStatus.FIRED },
                data: { status: client_1.OrderItemStatus.CLOSED, closedAt: now },
            });
            // Auditoria dos itens fechados
            if (firedItems.length > 0) {
                await tx.orderItemEvent.createMany({
                    data: firedItems.map((fi) => ({
                        tenantId,
                        orderItemId: fi.id,
                        userId: user.userId,
                        eventType: "STATUS_CHANGE",
                        fromStatus: client_1.OrderItemStatus.FIRED,
                        toStatus: client_1.OrderItemStatus.CLOSED,
                        reason: "Item closed with order",
                    })),
                });
            }
            // Atualiza totais e fecha a ordem
            await this.recomputeOrderTotals(tenantId, orderId, tx);
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: { status: client_1.OrderStatus.CLOSED, version: { increment: 1 } },
                include: { items: true },
            });
            // Auditoria da ordem
            await tx.orderEvent.create({
                data: {
                    tenantId,
                    orderId,
                    userId: user.userId,
                    eventType: "STATUS_CHANGE",
                    fromStatus: client_1.OrderStatus.OPEN,
                    toStatus: client_1.OrderStatus.CLOSED,
                    reason: "Order closed",
                },
            });
            return updatedOrder;
        });
        // SSE: notifica bump equivalente no fechamento da comanda
        if (affected > 0) {
            this.bus.publish({
                type: "ticket.bumped",
                tenantId,
                orderId,
                affected,
                at: now.toISOString(),
            });
        }
        // webhook (não crítico)
        try {
            await this.webhooks.queueEvent(tenantId, "order.closed", {
                orderId: result.id,
                subtotal: result.subtotal,
                total: result.total,
                closedAt: result.updatedAt,
            }, { deliverNow: true });
        }
        catch (e) {
            this.logger.warn(`Falha ao enfileirar webhook order.closed: ${String(e)}`);
        }
        return result;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        webhooks_service_1.WebhooksService,
        kds_bus_1.KdsBus // 👈 injeta o bus
    ])
], OrdersService);
