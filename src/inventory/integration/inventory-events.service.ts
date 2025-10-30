import { Injectable } from "@nestjs/common";
import { InventoryService } from "../inventory.service";
import { PrismaService } from "../../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";
import { StockMovementType } from "@prisma/client";

@Injectable()
export class InventoryEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService
  ) {}

  // Chame este método quando um OrderItem transitar para FIRE
  async onOrderItemFired(params: {
    tenantId: string;
    orderId: string;
    orderItemId: string;
    productId: string;
    quantity: number; // quantidade do item no pedido (inteiro ou decimal, se aplicável)
    toStatusVersion: number; // versão de status para compor a chave de idempotência
    blockIfNegative?: boolean; // padrão: true (MVP: bloquear FIRE se saldo insuficiente)
  }) {
    const uniqueScopePrefix = `inventory:fire:${params.orderItemId}:${params.toStatusVersion}`;

    return this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.findUnique({
        where: { productId: params.productId },
        include: { lines: true },
      });

      // Se não há receita, nada consome
      const lines = recipe?.lines ?? [];

      for (const line of lines) {
        // consumo = -qtyBase * quantity (em base)
        const consumption = new Decimal(line.qtyBase as any)
          .times(params.quantity)
          .times(-1)
          .toDecimalPlaces(3);

        await this.inventory.applyStockMovement(tx, {
          tenantId: params.tenantId,
          inventoryItemId: line.inventoryItemId,
          type: StockMovementType.SALE,
          qtyDelta: consumption,
          relatedOrderId: params.orderId,
          uniqueScopeKey: `${uniqueScopePrefix}:${line.inventoryItemId}`,
          blockIfNegative: params.blockIfNegative !== false,
        });
      }
      return { ok: true };
    });
  }

  // Chame este método quando um VOID for aprovado para o OrderItem
  async onOrderItemVoidApproved(params: {
    tenantId: string;
    orderId: string;
    orderItemId: string;
    productId: string;
    quantity: number;
    toStatusVersion: number;
  }) {
    const uniqueScopePrefix = `inventory:void:${params.orderItemId}:${params.toStatusVersion}`;

    return this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.findUnique({
        where: { productId: params.productId },
        include: { lines: true },
      });

      const lines = recipe?.lines ?? [];

      for (const line of lines) {
        // estorno = +qtyBase * quantity
        const refund = new Decimal(line.qtyBase as any)
          .times(params.quantity)
          .toDecimalPlaces(3);

        await this.inventory.applyStockMovement(tx, {
          tenantId: params.tenantId,
          inventoryItemId: line.inventoryItemId,
          type: StockMovementType.ADJUSTMENT,
          qtyDelta: refund,
          relatedOrderId: params.orderId,
          uniqueScopeKey: `${uniqueScopePrefix}:${line.inventoryItemId}`,
          blockIfNegative: false, // estorno não precisa bloquear
        });
      }
      return { ok: true };
    });
  }
}
