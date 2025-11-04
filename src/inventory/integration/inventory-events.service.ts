import { Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory.service";
import { StockMovementType } from "@prisma/client";

type FireParams = {
  tenantId: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  quantity: string | number | Decimal; // OrderItem.quantity (3 casas)
  toStatusVersion: number; // versão do item após FIRE
  blockIfNegative?: boolean; // default: FALSE (permitir saldo negativo)
};

type VoidParams = {
  tenantId: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  quantity: string | number | Decimal;
  toStatusVersion: number; // versão após VOID aprovado
};

@Injectable()
export class InventoryEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService
  ) {}

  private q3(v: string | number | Decimal) {
    return new Decimal(v as any).toDecimalPlaces(3);
  }

  /**
   * FIRE: consome estoque pelas linhas da receita.
   * Nova política: por padrão NÃO bloqueia saldo negativo (blockIfNegative = false).
   */
  async onOrderItemFired(params: FireParams) {
    const { tenantId, orderId, productId, orderItemId, toStatusVersion } =
      params;
    const qtyProduct = this.q3(params.quantity);

    const recipe = await this.prisma.recipe.findUnique({
      where: { productId },
      include: { lines: true },
    });

    if (!recipe || recipe.tenantId !== tenantId || recipe.lines.length === 0) {
      return { applied: 0, lines: [] as any[] };
    }

    return this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const line of recipe.lines) {
        const consumo = this.q3(
          new Decimal(line.qtyBase as any).times(qtyProduct)
        );
        if (consumo.lte(0)) continue;

        const uniqueScopeKey = `inventory:fire:${orderItemId}:${toStatusVersion}:${line.inventoryItemId}`;
        const r = await this.inventory.applyStockMovement(tx, {
          tenantId,
          inventoryItemId: line.inventoryItemId,
          type: StockMovementType.SALE,
          qtyDelta: consumo.negated(), // saída
          reason: `orderItem.fire:${orderItemId}`,
          relatedOrderId: orderId,
          uniqueScopeKey,
          // ⬇️ regra padrão agora é permitir negativo
          blockIfNegative: params.blockIfNegative ?? false,
        });
        results.push({ line: line.inventoryItemId, ...r });
      }
      return { applied: results.length, lines: results };
    });
  }

  /**
   * VOID aprovado: estorna 1:1 o consumo (entrada).
   * Nunca bloqueia pois é crédito.
   */
  async onOrderItemVoidApproved(params: VoidParams) {
    const { tenantId, orderId, productId, orderItemId, toStatusVersion } =
      params;
    const qtyProduct = this.q3(params.quantity);

    const recipe = await this.prisma.recipe.findUnique({
      where: { productId },
      include: { lines: true },
    });

    if (!recipe || recipe.tenantId !== tenantId || recipe.lines.length === 0) {
      return { applied: 0, lines: [] as any[] };
    }

    return this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const line of recipe.lines) {
        const consumo = this.q3(
          new Decimal(line.qtyBase as any).times(qtyProduct)
        );
        if (consumo.lte(0)) continue;

        const uniqueScopeKey = `inventory:void:${orderItemId}:${toStatusVersion}:${line.inventoryItemId}`;
        const r = await this.inventory.applyStockMovement(tx, {
          tenantId,
          inventoryItemId: line.inventoryItemId,
          type: StockMovementType.ADJUSTMENT, // estorno
          qtyDelta: consumo, // entrada
          reason: `orderItem.void:${orderItemId}`,
          relatedOrderId: orderId,
          uniqueScopeKey,
          blockIfNegative: false,
        });
        results.push({ line: line.inventoryItemId, ...r });
      }
      return { applied: results.length, lines: results };
    });
  }
}
