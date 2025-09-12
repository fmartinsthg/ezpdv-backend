import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  HttpException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  OrderItemStatus,
  OrderStatus,
  PrepStation,
  Prisma,
} from "@prisma/client";
import { WebhooksService } from "../webhooks/webhooks.service";
import { CashWindowPort } from "./ports/cash-window.port";

type PageOpts = { page?: number; pageSize?: number };
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 50;

@Injectable()
export class KdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
    private readonly cash: CashWindowPort
  ) {}

  /* -------------------------- helpers -------------------------- */

  private pg({ page, pageSize }: PageOpts) {
    const p = page ?? DEFAULT_PAGE;
    const s = pageSize ?? DEFAULT_SIZE;
    return { skip: (p - 1) * s, take: s, page: p, pageSize: s };
  }

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

  private async withCashWindow<T extends Prisma.OrderItemWhereInput>(
    tenantId: string,
    base: T
  ): Promise<T> {
    const win = await this.cash.getCurrentWindow(tenantId);
    if (!win?.from) return base;
    return {
      ...base,
      order: {
        ...(base as any).order,
        tenantId,
        createdAt: { gte: win.from, ...(win.to ? { lte: win.to } : {}) },
      },
    } as T;
  }

  /* -------------------------- queries -------------------------- */

  async listTickets(
    tenantId: string,
    station: PrepStation,
    status: OrderItemStatus = OrderItemStatus.FIRED,
    sinceISO?: string,
    opts?: PageOpts
  ) {
    const { skip, take, page, pageSize } = this.pg(opts ?? {});
    const since = sinceISO ? new Date(sinceISO) : undefined;

    const stationEnum = String(station).toUpperCase() as PrepStation;
    const statusEnum = String(status).toUpperCase() as OrderItemStatus;

    let where: Prisma.OrderItemWhereInput = {
      tenantId,
      station: stationEnum,
      status: statusEnum,
      firedAt: { not: null },
      voidedAt: null,
      order: { tenantId, status: OrderStatus.OPEN },
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

    const ticketsMap = new Map<string, any>();
    for (const it of items) {
      const o = it.order!;
      if (!ticketsMap.has(o.id)) {
        ticketsMap.set(o.id, {
          orderId: o.id,
          tableNumber: (o as any).tabNumber ?? undefined,
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

  async listItems(
    tenantId: string,
    station: PrepStation,
    status: OrderItemStatus = OrderItemStatus.FIRED,
    sinceISO?: string,
    opts?: PageOpts
  ) {
    const { skip, take, page, pageSize } = this.pg(opts ?? {});
    const since = sinceISO ? new Date(sinceISO) : undefined;

    const stationEnum = String(station).toUpperCase() as PrepStation;
    const statusEnum = String(status).toUpperCase() as OrderItemStatus;

    let where: Prisma.OrderItemWhereInput = {
      tenantId,
      station: stationEnum,
      status: statusEnum,
      firedAt: { not: null },
      voidedAt: null,
      order: { tenantId, status: OrderStatus.OPEN },
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
      tableNumber: (it.order as any)?.tabNumber ?? undefined,
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

  async completeItem(tenantId: string, itemId: string, actorUserId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, tenantId, voidedAt: null },
      select: { id: true, status: true, orderId: true, station: true },
    });
    if (!item) throw new NotFoundException("Item não encontrado");

    if (item.status === OrderItemStatus.CLOSED) {
      return { itemId, status: item.status, alreadyClosed: true };
    }
    if (item.status !== OrderItemStatus.FIRED) {
      throw new BadRequestException("Item não está em estado FIRED");
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const up = await tx.orderItem.update({
        where: { id: itemId },
        data: { status: OrderItemStatus.CLOSED, closedAt: now },
        select: { id: true, orderId: true, status: true, station: true },
      });

      await tx.orderItemEvent.create({
        data: {
          tenantId,
          orderItemId: itemId,
          userId: actorUserId,
          eventType: "STATUS_CHANGE",
          fromStatus: OrderItemStatus.FIRED,
          toStatus: OrderItemStatus.CLOSED,
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

    // webhook não-crítico
    try {
      await this.webhooks.queueEvent(
        tenantId,
        "order.item.closed",
        { orderId: updated.orderId, itemId: updated.id, by: "KDS" },
        { deliverNow: true }
      );
    } catch (_) {}

    return { itemId: updated.id, status: updated.status, alreadyClosed: false };
  }

  async bulkComplete(tenantId: string, itemIds: string[], actorUserId: string) {
    if (!itemIds?.length) return { affected: 0 };

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: {
          tenantId,
          id: { in: itemIds },
          status: OrderItemStatus.FIRED,
          voidedAt: null,
        },
        select: { id: true, orderId: true },
      });

      if (items.length === 0)
        return { affected: 0, perOrder: {} as Record<string, number> };

      await tx.orderItem.updateMany({
        where: {
          tenantId,
          id: { in: items.map((i) => i.id) },
          status: OrderItemStatus.FIRED,
          voidedAt: null,
        },
        data: { status: OrderItemStatus.CLOSED, closedAt: now },
      });

      for (const it of items) {
        await tx.orderItemEvent.create({
          data: {
            tenantId,
            orderItemId: it.id,
            userId: actorUserId,
            eventType: "STATUS_CHANGE",
            fromStatus: OrderItemStatus.FIRED,
            toStatus: OrderItemStatus.CLOSED,
            reason: "KDS.bulkComplete",
          },
        });
      }

      const perOrder: Record<string, number> = {};
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

      return { affected: items.length, perOrder };
    });

    // webhook não-crítico
    try {
      await this.webhooks.queueEvent(
        tenantId,
        "order.kds.bulk_closed",
        { affected: updated.affected },
        { deliverNow: true }
      );
    } catch (_) {}

    return updated;
  }

  async bumpTicket(
    tenantId: string,
    orderId: string,
    ifMatch: string,
    actorUserId: string
  ) {
    const expected = this.parseIfMatch(ifMatch);
    if (expected == null) {
      throw new HttpException("If-Match obrigatório para bump do ticket", 428);
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, status: OrderStatus.OPEN },
      select: { id: true, version: true },
    });
    if (!order) throw new NotFoundException("Ticket não encontrado");

    if (order.version !== expected) {
      throw new PreconditionFailedException(
        "Versão divergente (If-Match inválido)"
      );
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: {
          tenantId,
          orderId,
          status: OrderItemStatus.FIRED,
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
          status: OrderItemStatus.FIRED,
          voidedAt: null,
        },
        data: { status: OrderItemStatus.CLOSED, closedAt: now },
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
            fromStatus: OrderItemStatus.FIRED,
            toStatus: OrderItemStatus.CLOSED,
            reason: "KDS.bump",
          },
        });
      }

      return { orderVersion: order.version, affected: items.length };
    });

    // webhook não-crítico
    try {
      await this.webhooks.queueEvent(
        tenantId,
        "order.kds.bumped",
        { orderId, affected: updated.affected },
        { deliverNow: true }
      );
    } catch (_) {}

    return updated;
  }

  async recallTicket(tenantId: string, orderId: string, actorUserId: string) {
    const closed = await this.prisma.orderItem.findMany({
      where: {
        tenantId,
        orderId,
        status: OrderItemStatus.CLOSED,
        voidedAt: null,
      },
      select: { id: true },
    });
    if (closed.length === 0) return { affected: 0 };

    const res = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: {
          tenantId,
          orderId,
          status: OrderItemStatus.CLOSED,
          voidedAt: null,
        },
        data: { status: OrderItemStatus.FIRED, closedAt: null },
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
            fromStatus: OrderItemStatus.CLOSED,
            toStatus: OrderItemStatus.FIRED,
            reason: "KDS.recall",
          },
        });
      }

      return { affected: closed.length };
    });

    // webhook não-crítico
    try {
      await this.webhooks.queueEvent(
        tenantId,
        "order.kds.recalled",
        { orderId, affected: res.affected },
        { deliverNow: true }
      );
    } catch (_) {}

    return res;
  }
}
