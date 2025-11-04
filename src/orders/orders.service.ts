import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  PreconditionFailedException,
  Logger,
} from "@nestjs/common";
import {
  Prisma,
  PrismaClient,
  OrderStatus,
  OrderItemStatus,
  PrepStation,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersQueryDto } from "./dto/orders-query.dto";
import { AppendItemsDto } from "./dto/append-items.dto";
import { FireDto } from "./dto/fire.dto";
import { VoidItemDto } from "./dto/void-item.dto";
import { CloseOrderDto } from "./dto/close-order.dto";
import { AuthUser } from "../auth/jwt.strategy";
import { JwtService } from "@nestjs/jwt";
import { WebhooksService } from "../webhooks/webhooks.service";
import { KdsBus } from "../kds/kds.bus";

// ⬇️ NOVO: Integração com Inventário (FIRE/VOID)
import { InventoryEventsService } from "../inventory/integration/inventory-events.service";

type DbLike = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly webhooks: WebhooksService,
    private readonly bus: KdsBus,
    // ⬇️ NOVO
    private readonly inventoryEvents: InventoryEventsService
  ) {}

  /* -------------------------- If-Match helpers -------------------------- */

  /** Aceita 5, "5", W/"5". Retorna número inteiro ou null se não enviado. */
  private parseIfMatch(ifMatch?: string): number | null {
    if (!ifMatch) return null;
    const cleaned = String(ifMatch)
      .trim()
      .replace(/^W\/"?/, "")
      .replace(/"$/, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  /** Confere If-Match com a versão atual da ordem. Lança 412 se divergir. */
  private async assertIfMatch(
    tenantId: string,
    orderId: string,
    ifMatch?: string
  ) {
    const expected = this.parseIfMatch(ifMatch);
    if (expected == null) return;
    const row = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { version: true },
    });
    if (!row) throw new NotFoundException("Comanda não encontrada.");
    if (row.version !== expected) {
      throw new PreconditionFailedException(
        `If-Match falhou: versão atual é ${row.version}, esperada ${expected}.`
      );
    }
  }

  /* -------------------------- Utils -------------------------- */

  private toDecimal(
    n: number | string | undefined,
    fallback = 0
  ): Prisma.Decimal {
    if (n === undefined || n === null) return new Prisma.Decimal(fallback);
    return new Prisma.Decimal(typeof n === "string" ? n : n.toString());
  }

  private async loadProductsMap(tenantId: string, productIds: string[]) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: { id: true, price: true, isActive: true, prepStation: true },
    });
    return new Map(products.map((p) => [p.id, p]));
  }

  private async assertOrderInTenant(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
    });
    if (!order) throw new NotFoundException("Comanda não encontrada.");
    return order;
  }

  /** Recalcula subtotal/total e incrementa a versão. */
  private async recomputeOrderTotals(
    tenantId: string,
    orderId: string,
    db?: DbLike
  ) {
    const client = (db ?? this.prisma) as DbLike;

    const sums = await client.orderItem.aggregate({
      where: {
        tenantId,
        orderId,
        status: {
          in: [
            OrderItemStatus.STAGED,
            OrderItemStatus.FIRED,
            OrderItemStatus.CLOSED,
          ],
        },
      },
      _sum: { total: true },
    });

    const subtotal = new Prisma.Decimal(sums._sum.total || 0);
    const total = subtotal;

    await client.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        discount: new Prisma.Decimal(0),
        total,
        version: { increment: 1 },
      },
    });
  }

  /* -------------------------- Use cases -------------------------- */

  async create(
    tenantId: string,
    user: AuthUser,
    dto: CreateOrderDto,
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const existing = await this.prisma.order.findFirst({
        where: { tenantId, idempotencyKey },
        include: { items: true },
      });
      if (existing) return existing;
    }

    const prodIds = Array.from(new Set(dto.items.map((i) => i.productId)));
    const prodMap = await this.loadProductsMap(tenantId, prodIds);
    if (prodMap.size !== prodIds.length) {
      throw new NotFoundException("Produto(s) não encontrado(s) no tenant.");
    }

    let subtotal = new Prisma.Decimal(0);
    const itemsData = dto.items.map((it) => {
      const p = prodMap.get(it.productId)!;
      if (!p.isActive) throw new BadRequestException("Produto inativo.");
      const unitPrice =
        it.unitPrice !== undefined
          ? this.toDecimal(it.unitPrice)
          : new Prisma.Decimal(p.price);
      const qty = new Prisma.Decimal(it.quantity);
      if (unitPrice.lte(0))
        throw new BadRequestException("unitPrice deve ser maior que zero.");
      if (qty.lte(0))
        throw new BadRequestException("quantity deve ser maior que zero.");
      const totalItem = unitPrice.times(qty);
      subtotal = subtotal.plus(totalItem);
      return {
        tenantId,
        productId: it.productId,
        quantity: qty,
        unitPrice,
        total: totalItem,
        status: OrderItemStatus.STAGED,
        notes: it.notes,
      };
    });

    const total = subtotal;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId,
          status: OrderStatus.OPEN,
          tabNumber: dto.tabNumber,
          subtotal,
          discount: this.toDecimal(0),
          total,
          idempotencyKey: idempotencyKey || null,
          createdByUserId: user.userId,
          assignedToUserId: user.userId,
          items: { create: itemsData as any },
        },
        include: { items: true },
      });

      await tx.orderEvent.create({
        data: {
          tenantId,
          orderId: created.id,
          userId: user.userId,
          eventType: "CREATED",
          fromStatus: null,
          toStatus: OrderStatus.OPEN,
          reason: null,
        },
      });

      return created;
    });

    try {
      await this.webhooks.queueEvent(
        tenantId,
        "order.created",
        {
          order: {
            id: order.id,
            status: order.status,
            tabNumber: order.tabNumber,
            subtotal: order.subtotal,
            total: order.total,
            isSettled: order.isSettled ?? false,
            createdAt: order.createdAt,
          },
        },
        { deliverNow: true }
      );
    } catch (err) {
      this.logger.warn(
        `Falha ao enfileirar webhook order.created: ${String(err)}`
      );
    }

    return order;
  }

  async findAll(tenantId: string, user: AuthUser, query: OrdersQueryDto) {
    const { status, mine, q, page = 1, limit = 10 } = query;

    const take = Math.min(Number(limit) || 10, 100);
    const skip = (Number(page) - 1) * take;

    const where: Prisma.OrderWhereInput = { tenantId };
    if (status) where.status = status;
    if (q) where.tabNumber = { contains: q, mode: "insensitive" };
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

  async findOne(
    tenantId: string,
    id: string,
    opts?: { includePayments?: boolean }
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        ...(opts?.includePayments ? { payments: true } : {}),
      },
    });
    if (!order) throw new NotFoundException("Comanda não encontrada.");
    return order;
  }

  async appendItems(
    tenantId: string,
    user: AuthUser,
    orderId: string,
    dto: AppendItemsDto,
    ifMatch?: string
  ) {
    await this.assertIfMatch(tenantId, orderId, ifMatch);

    const order = await this.assertOrderInTenant(tenantId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(
        "Somente comandas OPEN podem receber novos itens."
      );
    }

    const prodIds = Array.from(new Set(dto.items.map((i) => i.productId)));
    const prodMap = await this.loadProductsMap(tenantId, prodIds);
    if (prodMap.size !== prodIds.length) {
      throw new NotFoundException("Produto(s) não encontrado(s) no tenant.");
    }

    const itemsData = dto.items.map((it) => {
      const p = prodMap.get(it.productId)!;
      if (!p.isActive) throw new BadRequestException("Produto inativo.");
      const unitPrice =
        it.unitPrice !== undefined
          ? this.toDecimal(it.unitPrice)
          : new Prisma.Decimal(p.price);
      const qty = new Prisma.Decimal(it.quantity);
      if (unitPrice.lte(0))
        throw new BadRequestException("unitPrice deve ser maior que zero.");
      if (qty.lte(0))
        throw new BadRequestException("quantity deve ser maior que zero.");
      const totalItem = unitPrice.times(qty);
      return {
        tenantId,
        orderId,
        productId: it.productId,
        quantity: qty,
        unitPrice,
        total: totalItem,
        status: OrderItemStatus.STAGED,
        notes: it.notes,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.createMany({ data: itemsData as any });

      const sums = await tx.orderItem.aggregate({
        where: {
          orderId,
          tenantId,
          status: {
            in: [
              OrderItemStatus.STAGED,
              OrderItemStatus.FIRED,
              OrderItemStatus.CLOSED,
            ],
          },
        },
        _sum: { total: true },
      });

      const subtotal = new Prisma.Decimal(sums._sum.total || 0);
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

    try {
      await this.webhooks.queueEvent(tenantId, "order.items_appended", {
        orderId,
        appendedCount: dto.items.length,
      });
    } catch (e) {
      this.logger.warn(
        `Falha ao enfileirar webhook order.items_appended: ${String(e)}`
      );
    }

    return this.findOne(tenantId, orderId);
  }

  async fireItems(
    tenantId: string,
    user: AuthUser,
    orderId: string,
    dto: FireDto,
    ifMatch?: string
  ) {
    await this.assertIfMatch(tenantId, orderId, ifMatch);

    const order = await this.assertOrderInTenant(tenantId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(
        "Apenas comandas OPEN podem disparar itens."
      );
    }

    const whereItems: Prisma.OrderItemWhereInput = {
      tenantId,
      orderId,
      status: OrderItemStatus.STAGED,
      ...(dto.itemIds?.length ? { id: { in: dto.itemIds } } : {}),
    };

    // Itens STAGED a disparar (carrega prepStation)
    const staged = await this.prisma.orderItem.findMany({
      where: whereItems,
      include: { product: { select: { prepStation: true } } },
    });
    if (staged.length === 0) {
      return this.findOne(tenantId, orderId);
    }

    const now = new Date();
    const toStatusVersion = (order.version ?? 0) + 1; // ⬅️ base para idempotência por transição

    // 1) Transição dos itens para FIRED e auditoria
    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        staged.map((s) =>
          tx.orderItem.update({
            where: { id: s.id },
            data: {
              status: OrderItemStatus.FIRED,
              station: s.product?.prepStation ?? PrepStation.KITCHEN,
              firedAt: now,
            },
          })
        )
      );

      await tx.orderItemEvent.createMany({
        data: staged.map((s) => ({
          tenantId,
          orderItemId: s.id,
          userId: user.userId,
          eventType: "STATUS_CHANGE",
          fromStatus: OrderItemStatus.STAGED,
          toStatus: OrderItemStatus.FIRED,
          reason: `Fired at ${s.product?.prepStation ?? PrepStation.KITCHEN}`,
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

    // 2) Consumo de estoque (um handler por item) — permite saldo negativo por padrão
    for (const s of staged) {
      await this.inventoryEvents.onOrderItemFired({
        tenantId,
        orderId,
        orderItemId: s.id,
        productId: s.productId,
        quantity: s.quantity,
        toStatusVersion,
        // blockIfNegative: false, // default já é false no InventoryEventsService
      });
    }

    // 3) Notificações (SSE) por item fired
    for (const s of staged) {
      this.bus.publish({
        type: "item.fired",
        tenantId,
        orderId,
        itemId: s.id,
        station: (s.product?.prepStation ?? PrepStation.KITCHEN) as PrepStation,
        at: now.toISOString(),
      });
    }

    // 4) Webhook (não crítico)
    try {
      await this.webhooks.queueEvent(
        tenantId,
        "order.items_fired",
        {
          orderId,
          itemIds: staged.map((s) => s.id),
          firedAt: now.toISOString(),
        },
        { deliverNow: true }
      );
    } catch (e) {
      this.logger.warn(
        `Falha ao enfileirar webhook order.items_fired: ${String(e)}`
      );
    }

    return this.findOne(tenantId, orderId);
  }

  async voidItem(
    tenantId: string,
    user: AuthUser,
    orderId: string,
    itemId: string,
    dto: VoidItemDto,
    approvalToken: string,
    ifMatch?: string
  ) {
    await this.assertIfMatch(tenantId, orderId, ifMatch);

    // valida aprovação
    let approver: any;
    try {
      const tokenStr = (approvalToken || "").replace(/^Bearer\s+/i, "");
      approver = this.jwtService.verify(tokenStr, {
        secret: process.env.JWT_SECRET || "ezpdv-secret",
      });
    } catch {
      throw new ForbiddenException("Token de aprovação inválido.");
    }
    const approverRoles = new Set<string>();
    if (approver?.systemRole)
      approverRoles.add(String(approver.systemRole).toUpperCase());
    if (approver?.role) approverRoles.add(String(approver.role).toUpperCase());
    if (
      !["SUPERADMIN", "ADMIN", "MODERATOR"].some((r) => approverRoles.has(r))
    ) {
      throw new ForbiddenException(
        "Aprovação requer MODERATOR/ADMIN/SUPERADMIN."
      );
    }

    const order = await this.assertOrderInTenant(tenantId, orderId);
    const toStatusVersion = (order.version ?? 0) + 1;

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, tenantId },
      select: { id: true, status: true, productId: true, quantity: true },
    });
    if (!item) throw new NotFoundException("Item não encontrado.");
    if (item.status !== OrderItemStatus.FIRED) {
      throw new BadRequestException(
        "Somente itens FIRED podem ser anulados (VOID)."
      );
    }

    // 1) Atualiza estado do item + auditoria + recomputa totais (incrementa versão)
    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          status: OrderItemStatus.VOID,
          voidedAt: new Date(),
          voidReason: dto.reason,
          voidByUserId: user.userId,
          voidApprovedBy: approver?.sub || null,
        },
      });

      await tx.orderItemEvent.create({
        data: {
          tenantId,
          orderItemId: item.id,
          userId: user.userId,
          eventType: "STATUS_CHANGE",
          fromStatus: OrderItemStatus.FIRED,
          toStatus: OrderItemStatus.VOID,
          reason: dto.reason ?? "VOID",
        },
      });

      await this.recomputeOrderTotals(tenantId, orderId, tx);
    });

    // 2) Estorno no inventário (entrada; idempotente por (item,version,inventoryItemId))
    await this.inventoryEvents.onOrderItemVoidApproved({
      tenantId,
      orderId,
      orderItemId: item.id,
      productId: item.productId,
      quantity: item.quantity,
      toStatusVersion,
    });

    // 3) Evento (não crítico)
    try {
      await this.webhooks.queueEvent(tenantId, "order.item_voided", {
        orderId,
        itemId: item.id,
      });
    } catch (e) {
      this.logger.warn(
        `Falha ao enfileirar webhook order.item_voided: ${String(e)}`
      );
    }

    return this.findOne(tenantId, orderId);
  }

  async cancel(
    tenantId: string,
    user: AuthUser,
    orderId: string,
    ifMatch?: string
  ) {
    await this.assertIfMatch(tenantId, orderId, ifMatch);

    const order = await this.assertOrderInTenant(tenantId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(
        "Somente comandas OPEN podem ser canceladas."
      );
    }

    const activeCount = await this.prisma.orderItem.count({
      where: {
        tenantId,
        orderId,
        status: { in: [OrderItemStatus.STAGED, OrderItemStatus.FIRED] },
      },
    });
    if (activeCount > 0) {
      throw new BadRequestException(
        "Remova itens STAGED e faça VOID dos FIRED antes de cancelar a comanda."
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELED, version: { increment: 1 } },
      });

      await tx.orderEvent.create({
        data: {
          tenantId,
          orderId,
          userId: user.userId,
          eventType: "STATUS_CHANGE",
          fromStatus: OrderStatus.OPEN,
          toStatus: OrderStatus.CANCELED,
          reason: "Order canceled",
        },
      });

      await this.recomputeOrderTotals(tenantId, orderId, tx);

      return tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true },
      });
    });

    try {
      await this.webhooks.queueEvent(tenantId, "order.canceled", { orderId });
    } catch (e) {
      this.logger.warn(
        `Falha ao enfileirar webhook order.canceled: ${String(e)}`
      );
    }

    return updated!;
  }

  async close(
    tenantId: string,
    user: AuthUser,
    orderId: string,
    _dto: CloseOrderDto,
    ifMatch?: string
  ) {
    await this.assertIfMatch(tenantId, orderId, ifMatch);

    const order = await this.assertOrderInTenant(tenantId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException(
        "Somente comandas OPEN podem ser fechadas."
      );
    }

    const staged = await this.prisma.orderItem.count({
      where: { tenantId, orderId, status: OrderItemStatus.STAGED },
    });
    if (staged > 0) {
      throw new BadRequestException(
        "Há itens STAGED. Remova-os ou faça FIRE antes de fechar."
      );
    }

    const now = new Date();
    let affected = 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const firedItems = await tx.orderItem.findMany({
        where: { tenantId, orderId, status: OrderItemStatus.FIRED },
        select: { id: true },
      });
      affected = firedItems.length;

      await tx.orderItem.updateMany({
        where: { tenantId, orderId, status: OrderItemStatus.FIRED },
        data: { status: OrderItemStatus.CLOSED, closedAt: now },
      });

      if (firedItems.length > 0) {
        await tx.orderItemEvent.createMany({
          data: firedItems.map((fi) => ({
            tenantId,
            orderItemId: fi.id,
            userId: user.userId,
            eventType: "STATUS_CHANGE",
            fromStatus: OrderItemStatus.FIRED,
            toStatus: OrderItemStatus.CLOSED,
            reason: "Item closed with order",
          })),
        });
      }

      await this.recomputeOrderTotals(tenantId, orderId, tx);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CLOSED, version: { increment: 1 } },
        include: { items: true },
      });

      await tx.orderEvent.create({
        data: {
          tenantId,
          orderId,
          userId: user.userId,
          eventType: "STATUS_CHANGE",
          fromStatus: OrderStatus.OPEN,
          toStatus: OrderStatus.CLOSED,
          reason: "Order closed",
        },
      });

      return updatedOrder;
    });

    if (affected > 0) {
      this.bus.publish({
        type: "ticket.bumped",
        tenantId,
        orderId,
        affected,
        at: now.toISOString(),
      });
    }

    try {
      await this.webhooks.queueEvent(
        tenantId,
        "order.closed",
        {
          orderId: result.id,
          subtotal: result.subtotal,
          total: result.total,
          closedAt: result.updatedAt,
        },
        { deliverNow: true }
      );
    } catch (e) {
      this.logger.warn(
        `Falha ao enfileirar webhook order.closed: ${String(e)}`
      );
    }

    return result;
  }
}
