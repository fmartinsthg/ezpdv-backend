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
exports.InventoryEventsService = void 0;
const common_1 = require("@nestjs/common");
const library_1 = require("@prisma/client/runtime/library");
const prisma_service_1 = require("../../prisma/prisma.service");
const inventory_service_1 = require("../inventory.service");
const client_1 = require("@prisma/client");
let InventoryEventsService = class InventoryEventsService {
    constructor(prisma, inventory) {
        this.prisma = prisma;
        this.inventory = inventory;
    }
    q3(v) {
        return new library_1.Decimal(v).toDecimalPlaces(3);
    }
    /**
     * FIRE: consome estoque pelas linhas da receita.
     * Nova política: por padrão NÃO bloqueia saldo negativo (blockIfNegative = false).
     */
    async onOrderItemFired(params) {
        const { tenantId, orderId, productId, orderItemId, toStatusVersion } = params;
        const qtyProduct = this.q3(params.quantity);
        const recipe = await this.prisma.recipe.findUnique({
            where: { productId },
            include: { lines: true },
        });
        if (!recipe || recipe.tenantId !== tenantId || recipe.lines.length === 0) {
            return { applied: 0, lines: [] };
        }
        return this.prisma.$transaction(async (tx) => {
            const results = [];
            for (const line of recipe.lines) {
                const consumo = this.q3(new library_1.Decimal(line.qtyBase).times(qtyProduct));
                if (consumo.lte(0))
                    continue;
                const uniqueScopeKey = `inventory:fire:${orderItemId}:${toStatusVersion}:${line.inventoryItemId}`;
                const r = await this.inventory.applyStockMovement(tx, {
                    tenantId,
                    inventoryItemId: line.inventoryItemId,
                    type: client_1.StockMovementType.SALE,
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
    async onOrderItemVoidApproved(params) {
        const { tenantId, orderId, productId, orderItemId, toStatusVersion } = params;
        const qtyProduct = this.q3(params.quantity);
        const recipe = await this.prisma.recipe.findUnique({
            where: { productId },
            include: { lines: true },
        });
        if (!recipe || recipe.tenantId !== tenantId || recipe.lines.length === 0) {
            return { applied: 0, lines: [] };
        }
        return this.prisma.$transaction(async (tx) => {
            const results = [];
            for (const line of recipe.lines) {
                const consumo = this.q3(new library_1.Decimal(line.qtyBase).times(qtyProduct));
                if (consumo.lte(0))
                    continue;
                const uniqueScopeKey = `inventory:void:${orderItemId}:${toStatusVersion}:${line.inventoryItemId}`;
                const r = await this.inventory.applyStockMovement(tx, {
                    tenantId,
                    inventoryItemId: line.inventoryItemId,
                    type: client_1.StockMovementType.ADJUSTMENT, // estorno
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
};
exports.InventoryEventsService = InventoryEventsService;
exports.InventoryEventsService = InventoryEventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_service_1.InventoryService])
], InventoryEventsService);
