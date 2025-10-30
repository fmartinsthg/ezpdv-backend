import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PrismaClient, StockMovementType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { AdjustInventoryItemDto } from "./dto/adjust-inventory-item.dto";
import { UpsertRecipeDto } from "./dto/upsert-recipe.dto";
import { ListItemsDto } from "./dto/list-items.dto";
import { ListMovementsDto } from "./dto/list-movements.dto";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private q3(v: string | number | Decimal) {
    return new Decimal(v as any).toDecimalPlaces(3);
  }

  // ====== Itens ======
  async listItems(tenantId: string, q: ListItemsDto) {
    const page = Number(q.page ?? 1);
    const pageSize = Math.min(Number(q.pageSize ?? 20), 100);

    return this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        ...(q.isIngredient ? { isIngredient: q.isIngredient === "true" } : {}),
        ...(q.name ? { name: { contains: q.name, mode: "insensitive" } } : {}),
        ...(q.lowStock ? { onHand: { lt: this.q3(q.lowStock) } } : {}),
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async createItem(tenantId: string, dto: CreateInventoryItemDto) {
    const factor = this.q3(dto.factorToBase);
    if (factor.lte(0))
      throw new BadRequestException("factorToBase deve ser > 0");
    const onHand = this.q3(dto.onHand);
    if (onHand.lt(0)) throw new BadRequestException("onHand deve ser >= 0");

    try {
      return await this.prisma.inventoryItem.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          unit: dto.unit,
          factorToBase: factor,
          onHand,
          isIngredient: dto.isIngredient,
        },
      });
    } catch (e: any) {
      if (e.code === "P2002")
        throw new ConflictException("Nome já existe neste tenant");
      throw e;
    }
  }

  async getItemDetail(tenantId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException("Item não encontrado");

    const recentMovs = await this.prisma.stockMovement.findMany({
      where: { tenantId, inventoryItemId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const referencedBy = await this.prisma.recipeLine.findMany({
      where: { tenantId, inventoryItemId: id },
      select: { productId: true, qtyBase: true },
      take: 50,
    });

    return { item, recentMovs, referencedBy };
  }

  async updateItem(tenantId: string, id: string, dto: UpdateInventoryItemDto) {
    const patch: Prisma.InventoryItemUpdateInput = {};

    if (dto.name) patch.name = dto.name.trim();

    if (dto.unit) {
      // TODO: validar impacto em receitas existentes antes de permitir migração de unidade
      const lines = await this.prisma.recipeLine.count({
        where: { tenantId, inventoryItemId: id },
      });
      if (lines > 0)
        throw new ConflictException(
          "Alterar unidade exigiria migração de receitas existentes"
        );
      patch.unit = dto.unit;
    }

    if (dto.factorToBase !== undefined) {
      const factor = this.q3(dto.factorToBase);
      if (factor.lte(0))
        throw new BadRequestException("factorToBase deve ser > 0");
      patch.factorToBase = factor;
    }

    if (dto.isIngredient !== undefined) patch.isIngredient = dto.isIngredient;

    try {
      return await this.prisma.inventoryItem.update({
        where: { id },
        data: patch,
      });
    } catch (e: any) {
      if (e.code === "P2002")
        throw new ConflictException("Nome já existe neste tenant");
      throw e;
    }
  }

  // ====== Movimentação atômica ======
  async applyStockMovement(
    tx: PrismaClient | Prisma.TransactionClient,
    params: {
      tenantId: string;
      inventoryItemId: string;
      type: StockMovementType;
      qtyDelta: Decimal | string | number; // +/-
      reason?: string;
      relatedOrderId?: string;
      uniqueScopeKey?: string; // para idempotência interna opcional
      blockIfNegative?: boolean; // padrão true
    }
  ) {
    const qtyDelta = this.q3(params.qtyDelta);
    const blockIfNegative = params.blockIfNegative !== false;

    // Row lock para evitar corrida: bloqueia a linha do item
    await tx.$executeRawUnsafe(
      `SELECT id FROM "InventoryItem" WHERE id = $1 AND "tenantId" = $2 FOR UPDATE`,
      params.inventoryItemId,
      params.tenantId
    );

    const item = await tx.inventoryItem.findFirst({
      where: { id: params.inventoryItemId, tenantId: params.tenantId },
    });
    if (!item) throw new NotFoundException("Item não encontrado");

    const newOnHand = new Decimal(item.onHand as any)
      .plus(qtyDelta)
      .toDecimalPlaces(3);
    if (blockIfNegative && newOnHand.lt(0)) {
      throw new ConflictException("Saldo insuficiente para a operação");
    }

    // Se usar idempotência interna via uniqueScopeKey (ex.: eventos FIRE/VOID)
    if (params.uniqueScopeKey) {
      const exists = await tx.stockMovement.findFirst({
        where: { uniqueScopeKey: params.uniqueScopeKey },
        select: { id: true },
      });
      if (exists) return { idempotent: true };
    }

    await tx.inventoryItem.update({
      where: { id: params.inventoryItemId },
      data: { onHand: newOnHand },
    });

    const mov = await tx.stockMovement.create({
      data: {
        tenantId: params.tenantId,
        inventoryItemId: params.inventoryItemId,
        type: params.type,
        qtyDelta,
        reason: params.reason,
        relatedOrderId: params.relatedOrderId ?? null,
        uniqueScopeKey: params.uniqueScopeKey ?? null,
      },
    });

    return { idempotent: false, movement: mov, newOnHand };
  }

  async adjustItem(tenantId: string, id: string, dto: AdjustInventoryItemDto) {
    const reason = dto.reason ?? "adjustment";
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findFirst({
        where: { id, tenantId },
      });
      if (!current) throw new NotFoundException("Item não encontrado");

      let delta: Decimal;
      if (dto.newOnHand !== undefined) {
        delta = this.q3(dto.newOnHand).minus(current.onHand as any);
      } else if (dto.delta !== undefined) {
        delta = this.q3(dto.delta);
      } else {
        throw new BadRequestException("Informe newOnHand ou delta");
      }

      return this.applyStockMovement(tx, {
        tenantId,
        inventoryItemId: id,
        type: StockMovementType.ADJUSTMENT,
        qtyDelta: delta,
        reason,
        blockIfNegative: true,
      });
    });
  }

  // ====== Recipes ======
  async getRecipe(tenantId: string, productId: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { productId },
      include: { lines: { orderBy: { inventoryItemId: "asc" } } },
    });
    if (!recipe || recipe.tenantId !== tenantId) {
      // tolerância: se não existir, retorna vazia
      return { productId, tenantId, lines: [] as any[] };
    }
    return recipe;
  }

  async upsertRecipe(
    tenantId: string,
    productId: string,
    dto: UpsertRecipeDto
  ) {
    // valida duplicatas e qty > 0
    const seen = new Set<string>();
    for (const l of dto.lines) {
      if (seen.has(l.inventoryItemId))
        throw new BadRequestException("Item duplicado na receita");
      seen.add(l.inventoryItemId);
      if (this.q3(l.qtyBase).lte(0))
        throw new BadRequestException("qtyBase deve ser > 0");
    }

    // valida existência dos itens
    const itemIds = dto.lines.map((l) => l.inventoryItemId);
    const count = await this.prisma.inventoryItem.count({
      where: { tenantId, id: { in: itemIds } },
    });
    if (count !== itemIds.length)
      throw new BadRequestException("Algum inventoryItemId é inválido");

    return this.prisma.$transaction(async (tx) => {
      await tx.recipe.upsert({
        where: { productId },
        update: { tenantId },
        create: { productId, tenantId },
      });

      // apaga e recria (MVP simples e seguro)
      await tx.recipeLine.deleteMany({ where: { tenantId, productId } });
      await tx.recipeLine.createMany({
        data: dto.lines.map((l) => ({
          id: crypto.randomUUID(),
          tenantId,
          productId,
          inventoryItemId: l.inventoryItemId,
          qtyBase: this.q3(l.qtyBase),
        })),
      });

      return this.getRecipe(tenantId, productId);
    });
  }

  // ====== Movements (query) ======
  async listMovements(tenantId: string, q: ListMovementsDto) {
    const page = Number(q.page ?? 1);
    const pageSize = Math.min(Number(q.pageSize ?? 50), 200);
    return this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        ...(q.inventoryItemId ? { inventoryItemId: q.inventoryItemId } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.relatedOrderId ? { relatedOrderId: q.relatedOrderId } : {}),
        ...(q.dateFrom || q.dateTo
          ? {
              createdAt: {
                ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}),
                ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}
