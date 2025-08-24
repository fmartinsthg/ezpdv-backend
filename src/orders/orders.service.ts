import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, PrismaClient, OrderStatus, OrderItemStatus, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, CreatePaymentDto } from './dto/create-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { AppendItemsDto } from './dto/append-items.dto';
import { FireDto } from './dto/fire.dto';
import { VoidItemDto } from './dto/void-item.dto';
import { CloseOrderDto } from './dto/close-order.dto';
import { AuthUser } from '../auth/jwt.strategy';
import { JwtService } from '@nestjs/jwt';

const MAX_RETRIES = 3;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /* -------------------------- Helpers -------------------------- */

  private toDecimal(n: number | string | undefined, fallback = 0): Prisma.Decimal {
    if (n === undefined || n === null) return new Prisma.Decimal(fallback);
    return new Prisma.Decimal(typeof n === 'string' ? n : n.toString());
  }

  private sumPayments(payments?: CreatePaymentDto[]): Prisma.Decimal {
    if (!payments || payments.length === 0) return this.toDecimal(0);
    return payments
      .map((p) => this.toDecimal(p.amount))
      .reduce((a, b) => a.plus(b), this.toDecimal(0));
  }

  private async loadProductsMap(tenantId: string, productIds: string[]) {
    const products = await this.prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: { id: true, price: true, isActive: true },
    });
    const map = new Map(products.map((p) => [p.id, p]));
    return map;
  }

  private async assertOrderInTenant(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
    });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    return order;
  }

  private async computeRequiredInventory(
    tenantId: string,
    items: { productId: string; quantity: Prisma.Decimal }[],
    tx: PrismaClient,
  ) {
    // Aggregate required quantities by InventoryItem using Recipe/RecipeLine
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const recipes = await tx.recipe.findMany({
      where: { tenantId, productId: { in: productIds } },
      include: { lines: true },
    });

    // Map productId -> lines
    const recipeByProduct = new Map(recipes.map((r) => [r.productId, r.lines]));

    // inventoryItemId -> requiredQty
    const required = new Map<string, Prisma.Decimal>();

    for (const it of items) {
      const lines = recipeByProduct.get(it.productId) || [];
      for (const line of lines) {
        const need = new Prisma.Decimal(line.qtyBase).times(it.quantity);
        const prev = required.get(line.inventoryItemId) || this.toDecimal(0);
        required.set(line.inventoryItemId, prev.plus(need));
      }
    }

    return required; // Map<inventoryItemId, qty>
  }

  private async checkAndDebitInventorySerializable(
    tenantId: string,
    orderId: string,
    required: Map<string, Prisma.Decimal>,
  ) {
    let attempt = 0;
    while (true) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // Load current onHand for all inventory items involved
          const invIds = Array.from(required.keys());
          if (invIds.length === 0) return;

          const items = await tx.inventoryItem.findMany({
            where: { tenantId, id: { in: invIds } },
            select: { id: true, onHand: true },
          });

          // Check sufficiency
          for (const inv of items) {
            const need = required.get(inv.id) || this.toDecimal(0);
            if (new Prisma.Decimal(inv.onHand).lt(need)) {
              throw new ConflictException('Estoque insuficiente para produção.');
            }
          }

          // Debit (write) + StockMovement
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
                type: StockMovementType.SALE, // saída
                qtyDelta: need.negated(),     // negativo
                relatedOrderId: orderId,
                reason: 'ORDER_ITEM_FIRE',
              },
            });
          }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (e: any) {
        // Retry on serialization failure
        if (e?.code === 'P2034' || String(e?.message || '').includes('could not serialize access')) {
          if (++attempt >= MAX_RETRIES) throw e;
          // small backoff
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
    toCredit: Map<string, Prisma.Decimal>,
  ) {
    let attempt = 0;
    while (true) {
      try {
        return await this.prisma.$transaction(async (tx) => {
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
                type: StockMovementType.ADJUSTMENT, // retorno
                qtyDelta: qty,                       // positivo
                relatedOrderId: orderId,
                reason: 'ORDER_ITEM_VOID_OR_CANCEL',
              },
            });
          }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (e: any) {
        if (e?.code === 'P2034' || String(e?.message || '').includes('could not serialize access')) {
          if (++attempt >= MAX_RETRIES) throw e;
          await new Promise((r) => setTimeout(r, 50 * attempt));
          continue;
        }
        throw e;
      }
    }
  }

  /* -------------------------- Use cases -------------------------- */

  async create(tenantId: string, user: AuthUser, dto: CreateOrderDto, idempotencyKey?: string) {
    // Idempotência por (tenantId, idempotencyKey)
    if (idempotencyKey) {
      const existing = await this.prisma.order.findFirst({
        where: { tenantId, idempotencyKey },
        include: { items: true, payments: true },
      });
      if (existing) return existing;
    }

    // Produtos e preços
    const prodIds = Array.from(new Set(dto.items.map((i) => i.productId)));
    const prodMap = await this.loadProductsMap(tenantId, prodIds);
    if (prodMap.size !== prodIds.length) {
      throw new NotFoundException('Produto(s) não encontrado(s) no tenant.');
    }

    // Monta items STAGED e calcula subtotal
    let subtotal = new Prisma.Decimal(0);
    const itemsData = dto.items.map((it) => {
      const p = prodMap.get(it.productId)!;
      if (!p.isActive) {
        throw new BadRequestException('Produto inativo.');
      }
      const unitPrice = it.unitPrice !== undefined ? this.toDecimal(it.unitPrice) : new Prisma.Decimal(p.price);
      const qty = new Prisma.Decimal(it.quantity);
      const total = unitPrice.times(qty);
      subtotal = subtotal.plus(total);
      return {
        tenantId,
        productId: it.productId,
        quantity: qty,
        unitPrice,
        total,
        status: OrderItemStatus.STAGED,
        notes: it.notes,
      };
    });

    const discount = this.toDecimal(dto.discount || 0);
    if (discount.lt(0)) throw new BadRequestException('Desconto inválido.');
    const total = Prisma.Decimal.max(subtotal.minus(discount), new Prisma.Decimal(0));

    const paidSum = this.sumPayments(dto.payments);
    if (paidSum.gt(total)) {
      throw new BadRequestException('Pagamentos não podem exceder o total.');
    }

    try {
      const order = await this.prisma.order.create({
        data: {
          tenantId,
          status: OrderStatus.OPEN,
          tabNumber: dto.tabNumber,
          subtotal,
          discount,
          total,
          idempotencyKey: idempotencyKey || null,
          createdByUserId: user.sub,
          assignedToUserId: user.sub,
          items: { createMany: { data: itemsData as any } },
          payments: dto.payments && dto.payments.length > 0 ? {
            createMany: {
              data: dto.payments.map((p) => ({
                tenantId,
                method: p.method,
                amount: this.toDecimal(p.amount),
                reference: p.reference || null,
              })),
            },
          } : undefined,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      return order;
    } catch (err: any) {
      if (err?.code === 'P2002' && String(err?.meta?.target || '').includes('tenantId_idempotencyKey')) {
        // Conflito de idempotência: retorna registro existente
        const existing = await this.prisma.order.findFirst({
          where: { tenantId, idempotencyKey },
          include: { items: true, payments: true },
        });
        if (existing) return existing;
      }
      if (err?.code === '22P02') throw new BadRequestException('IDs devem ser UUID válidos.');
      throw err;
    }
  }

  async findAll(tenantId: string, user: AuthUser, query: OrdersQueryDto) {
    const {
      status,
      mine,
      q,
      page = 1,
      limit = 10,
    } = query;

    const take = Math.min(Number(limit) || 10, 100);
    const skip = (Number(page) - 1) * take;

    const where: Prisma.OrderWhereInput = { tenantId };
    if (status) where.status = status;
    if (q) where.tabNumber = { contains: q, mode: 'insensitive' };
    if (String(mine).toLowerCase() === 'true') {
      where.assignedToUserId = user.sub;
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          status: true,
          tabNumber: true,
          subtotal: true,
          discount: true,
          total: true,
          createdAt: true,
          updatedAt: true,
          assignedToUserId: true,
          _count: { select: { items: true, payments: true } },
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

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        payments: true,
      },
    });
    if (!order) throw new NotFoundException('Comanda não encontrada.');
    return order;
  }

  async appendItems(tenantId: string, user: AuthUser, orderId: string, dto: AppendItemsDto) {
    const order = await this.assertOrderInTenant(tenantId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException('Somente comandas OPEN podem receber novos itens.');
    }

    const prodIds = Array.from(new Set(dto.items.map((i) => i.productId)));
    const prodMap = await this.loadProductsMap(tenantId, prodIds);
    if (prodMap.size !== prodIds.length) {
      throw new NotFoundException('Produto(s) não encontrado(s) no tenant.');
    }

    // Build new STAGED items and recalc subtotal/total
    let addSubtotal = new Prisma.Decimal(0);
    const itemsData = dto.items.map((it) => {
      const p = prodMap.get(it.productId)!;
      if (!p.isActive) {
        throw new BadRequestException('Produto inativo.');
      }
      const unitPrice = it.unitPrice !== undefined ? this.toDecimal(it.unitPrice) : new Prisma.Decimal(p.price);
      const qty = new Prisma.Decimal(it.quantity);
      const total = unitPrice.times(qty);
      addSubtotal = addSubtotal.plus(total);
      return {
        tenantId,
        orderId,
        productId: it.productId,
        quantity: qty,
        unitPrice,
        total,
        status: OrderItemStatus.STAGED,
        notes: it.notes,
      };
    });

    const newTotals = await this.prisma.$transaction(async (tx) => {
      // append items
      await tx.orderItem.createMany({ data: itemsData as any });

      // recalc order totals
      const sums = await tx.orderItem.aggregate({
        where: { orderId, tenantId, status: { in: [OrderItemStatus.STAGED, OrderItemStatus.FIRED, OrderItemStatus.CLOSED] } },
        _sum: { total: true },
      });

      const subtotal = new Prisma.Decimal(sums._sum.total || 0);
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { discount: true } });
      const discount = new Prisma.Decimal(current?.discount || 0);
      const total = Prisma.Decimal.max(subtotal.minus(discount), new Prisma.Decimal(0));

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { subtotal, total, assignedToUserId: user.sub, version: { increment: 1 } },
      });

      return updated;
    });

    return this.findOne(tenantId, orderId);
  }

  async fireItems(tenantId: string, user: AuthUser, orderId: string, dto: FireDto) {
    const order = await this.assertOrderInTenant(tenantId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException('Apenas comandas OPEN podem disparar itens.');
    }

    // Seleciona itens STAGED (ou subset)
    const whereItems: Prisma.OrderItemWhereInput = {
      tenantId,
      orderId,
      status: OrderItemStatus.STAGED,
      ...(dto.itemIds?.length ? { id: { in: dto.itemIds } } : {}),
    };

    const staged = await this.prisma.orderItem.findMany({
      where: whereItems,
      select: { id: true, productId: true, quantity: true },
    });

    if (staged.length === 0) {
      // Idempotente: nada a fazer
      return this.findOne(tenantId, orderId);
    }

    // Calcula consumo necessário
    const required = await this.computeRequiredInventory(
      tenantId,
      staged.map((s) => ({ productId: s.productId, quantity: new Prisma.Decimal(s.quantity) })),
      this.prisma,
    );

    // Debita estoque (transação SERIALIZABLE + retry)
    await this.checkAndDebitInventorySerializable(tenantId, orderId, required);

    // Atualiza itens para FIRED + firedAt
    await this.prisma.orderItem.updateMany({
      where: { id: { in: staged.map((s) => s.id) } },
      data: { status: OrderItemStatus.FIRED, firedAt: new Date() },
    });

    // bump version da order
    await this.prisma.order.update({
      where: { id: orderId },
      data: { assignedToUserId: user.sub, version: { increment: 1 } },
    });

    return this.findOne(tenantId, orderId);
  }

  async voidItem(tenantId: string, user: AuthUser, orderId: string, itemId: string, dto: VoidItemDto, approvalToken: string) {
    // Valida aprovação
    let approver: any;
    try {
      approver = this.jwtService.verify(approvalToken, {
        secret: process.env.JWT_SECRET || 'ezpdv-secret',
      });
    } catch {
      throw new ForbiddenException('Token de aprovação inválido.');
    }

    const approverRoles = new Set<string>();
    if (approver?.systemRole) approverRoles.add(String(approver.systemRole).toUpperCase());
    if (approver?.role) approverRoles.add(String(approver.role).toUpperCase());
    if (!['SUPERADMIN', 'ADMIN', 'MODERATOR'].some((r) => approverRoles.has(r))) {
      throw new ForbiddenException('Aprovação requer MODERATOR/ADMIN/SUPERADMIN.');
    }

    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, tenantId },
      select: { id: true, status: true, productId: true, quantity: true },
    });
    if (!item) throw new NotFoundException('Item não encontrado.');
    if (item.status !== OrderItemStatus.FIRED) {
      throw new BadRequestException('Somente itens FIRED podem ser anulados (VOID).');
    }

    // Calcula crédito de estoque
    const toCredit = await this.computeRequiredInventory(
      tenantId,
      [{ productId: item.productId, quantity: new Prisma.Decimal(item.quantity) }],
      this.prisma,
    );

    // Credita estoque
    await this.creditInventorySerializable(tenantId, orderId, toCredit);

    // Atualiza item -> VOID
    await this.prisma.orderItem.update({
      where: { id: item.id },
      data: {
        status: OrderItemStatus.VOID,
        voidedAt: new Date(),
        voidReason: dto.reason,
        voidByUserId: user.sub,
        voidApprovedBy: approver?.sub || null,
      },
    });

    // bump version da order
    await this.prisma.order.update({
      where: { id: orderId },
      data: { version: { increment: 1 } },
    });

    return this.findOne(tenantId, orderId);
  }

  async cancel(tenantId: string, _user: AuthUser, orderId: string) {
    const order = await this.assertOrderInTenant(tenantId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException('Somente comandas OPEN podem ser canceladas.');
    }

    // Não pode haver itens ativos (STAGED ou FIRED)
    const activeCount = await this.prisma.orderItem.count({
      where: {
        tenantId,
        orderId,
        status: { in: [OrderItemStatus.STAGED, OrderItemStatus.FIRED] },
      },
    });
    if (activeCount > 0) {
      throw new BadRequestException('Remova itens STAGED e faça VOID dos FIRED antes de cancelar a comanda.');
    }

    // Nenhum movimento de estoque aqui (estoque já foi recreditado via VOID)
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELED,
        version: { increment: 1 },
      },
      include: { items: true, payments: true },
    });

    return updated;
  }

  async close(tenantId: string, _user: AuthUser, orderId: string, _dto: CloseOrderDto) {
    const order = await this.assertOrderInTenant(tenantId, orderId);
    if (order.status !== OrderStatus.OPEN) {
      throw new BadRequestException('Somente comandas OPEN podem ser fechadas.');
    }

    // Não pode restar STAGED para fechar (carrinho pendente)
    const staged = await this.prisma.orderItem.count({
      where: { tenantId, orderId, status: OrderItemStatus.STAGED },
    });
    if (staged > 0) {
      throw new BadRequestException('Há itens STAGED. Remova-os ou faça FIRE antes de fechar.');
    }

    // Marca itens efetivos como CLOSED e a Ordem também.
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { tenantId, orderId, status: { in: [OrderItemStatus.FIRED] } },
        data: { status: OrderItemStatus.CLOSED },
      });

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CLOSED, version: { increment: 1 } },
        include: { items: true, payments: true },
      });

      return updated;
    });

    return result;
  }
}
