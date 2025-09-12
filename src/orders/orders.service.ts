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
  StockMovementType,
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

const MAX_RETRIES = 3;
type DbLike = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly webhooks: WebhooksService
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
    if (expected == null) return; // header não enviado -> não valida
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

  private async computeRequiredInventory(
    tenantId: string,
    items: { productId: string; quantity: Prisma.Decimal }[],
    tx: DbLike
  ) {
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const recipes = await tx.recipe.findMany({
      where: { tenantId, productId: { in: productIds } },
      include: { lines: true },
    });

    const recipeByProduct = new Map(recipes.map((r) => [r.productId, r.lines]));
    const required = new Map<string, Prisma.Decimal>();

    for (const it of items) {
      const lines = recipeByProduct.get(it.productId) || [];
      for (const line of lines) {
        const need = new Prisma.Decimal(line.qtyBase).times(it.quantity);
        const prev = required.get(line.inventoryItemId) || this.toDecimal(0);
        required.set(line.inventoryItemId, prev.plus(need));
      }
    }

    return required;
  }

  private async checkAndDebitInventorySerializable(
    tenantId: string,
    orderId: string,
    required: Map<string, Prisma.Decimal>
  ) {
    let attempt = 0;
    while (true) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const invIds = Array.from(required.keys());
            if (invIds.length === 0) return;

            const items = await tx.inventoryItem.findMany({
              where: { tenantId, id: { in: invIds } },
              select: { id: true, onHand: true },
            });

            for (const inv of items) {
              const need = required.get(inv.id) || this.toDecimal(0);
              if (new Prisma.Decimal(inv.onHand).lt(need)) {
                throw new ConflictException(
                  "Estoque insuficiente para produção."
                );
              }
            }

            for (const inv of items) {
              const need = required.get(inv.id) || this.toDecimal(0);
              if (need.eq(0)) continue;

              const newOnHand = new Prisma.Decimal(inv.onHand).minus(need);

              await tx.inventoryItem.update({
                where: { id: inv.id },
                data: { onHand: newOnHand },
              });

              await tx.stockMovement.create({
                data: {
                  tenantId,
                  inventoryItemId: inv.id,
                  type: StockMovementType.SALE,
                  qtyDelta: need.negated(),
                  relatedOrderId: orderId,
                  reason: "ORDER_ITEM_FIRE",
                },
              });
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (e: any) {
        if (
          e?.code === "P2034" ||
          String(e?.message || "").includes("could not serialize access")
        ) {
          if (++attempt >= MAX_RETRIES) throw e;
          await new Promise((r) => setTimeout(r, 50 * attempt));
          continue;
        }
        throw e;
      }
    }
  }

  private async creditInventorySerializable(
    tenantId: string,
    orderId: string,
    toCredit: Map<string, Prisma.Decimal>
  ) {
    let attempt = 0;
    while (true) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const invIds = Array.from(toCredit.keys());
            if (invIds.length === 0) return;

            const items = await tx.inventoryItem.findMany({
              where: { tenantId, id: { in: invIds } },
              select: { id: true, onHand: true },
            });

            for (const inv of items) {
              const qty = toCredit.get(inv.id) || this.toDecimal(0);
              if (qty.eq(0)) continue;

              const newOnHand = new Prisma.Decimal(inv.onHand).plus(qty);

              await tx.inventoryItem.update({
                where: { id: inv.id },
                data: { onHand: newOnHand },
              });

              await tx.stockMovement.create({
                data: {
                  tenantId,
                  inventoryItemId: inv.id,
                  type: StockMovementType.ADJUSTMENT,
                  qtyDelta: qty,
                  relatedOrderId: orderId,
                  reason: "ORDER_ITEM_VOID_OR_CANCEL",
                },
              });
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (e: any) {
        if (
          e?.code === "P2034" ||
          String(e?.message || "").includes("could not serialize access")
        ) {
          if (++attempt >= MAX_RETRIES) throw e;
          await new Promise((r) => setTimeout(r, 50 * attempt));
          continue;
        }
        throw e;
      }
    }
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

    // cria a ordem (transação)
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

      // auditoria da criação
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

    // webhook fora da transação
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

    // evento opcional (não crítico)
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

    // Itens STAGED a disparar
    const staged = await this.prisma.orderItem.findMany({
      where: whereItems,
      include: { product: { select: { prepStation: true } } },
    });
    if (staged.length === 0) {
      return this.findOne(tenantId, orderId);
    }

    // Calcula estoque a debitar
    const required = await this.computeRequiredInventory(
      tenantId,
      staged.map((s) => ({
        productId: s.productId,
        quantity: new Prisma.Decimal(s.quantity),
      })),
      this.prisma
    );
    await this.checkAndDebitInventorySerializable(tenantId, orderId, required);

    const now = new Date();

    // Mapa de estação por produto
    const prodIds = Array.from(new Set(staged.map((s) => s.productId)));
    const prodStations = await this.prisma.product.findMany({
      where: { tenantId, id: { in: prodIds } },
      select: { id: true, prepStation: true },
    });
    const stationByProduct = new Map<string, PrepStation | null>(
      prodStations.map((p) => [
        p.id,
        (p.prepStation as PrepStation | null) ?? null,
      ])
    );

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

    // Webhook (não crítico)
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

    const toCredit = await this.computeRequiredInventory(
      tenantId,
      [
        {
          productId: item.productId,
          quantity: new Prisma.Decimal(item.quantity),
        },
      ],
      this.prisma
    );
    await this.creditInventorySerializable(tenantId, orderId, toCredit);

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

      // Auditoria do item VOID
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

    // evento (não crítico)
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

      // Auditoria da ordem
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

    // webhook (não crítico)
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

    const result = await this.prisma.$transaction(async (tx) => {
      // Captura IDs dos itens FIRED antes de fechar (para auditoria)
      const firedItems = await tx.orderItem.findMany({
        where: { tenantId, orderId, status: OrderItemStatus.FIRED },
        select: { id: true },
      });

      // Fecha itens
      await tx.orderItem.updateMany({
        where: { tenantId, orderId, status: OrderItemStatus.FIRED },
        data: { status: OrderItemStatus.CLOSED, closedAt: now },
      });

      // Auditoria dos itens fechados
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

      // Atualiza totais e fecha a ordem
      await this.recomputeOrderTotals(tenantId, orderId, tx);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CLOSED, version: { increment: 1 } },
        include: { items: true },
      });

      // Auditoria da ordem
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

    // webhook (não crítico)
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
