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
const inventory_service_1 = require("../inventory.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
const client_1 = require("@prisma/client");
let InventoryEventsService = class InventoryEventsService {
    constructor(prisma, inventory) {
        this.prisma = prisma;
        this.inventory = inventory;
    }
    // Chame este método quando um OrderItem transitar para FIRE
    async onOrderItemFired(params) {
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
                const consumption = new library_1.Decimal(line.qtyBase)
                    .times(params.quantity)
                    .times(-1)
                    .toDecimalPlaces(3);
                await this.inventory.applyStockMovement(tx, {
                    tenantId: params.tenantId,
                    inventoryItemId: line.inventoryItemId,
                    type: client_1.StockMovementType.SALE,
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
    async onOrderItemVoidApproved(params) {
        const uniqueScopePrefix = `inventory:void:${params.orderItemId}:${params.toStatusVersion}`;
        return this.prisma.$transaction(async (tx) => {
            const recipe = await tx.recipe.findUnique({
                where: { productId: params.productId },
                include: { lines: true },
            });
            const lines = recipe?.lines ?? [];
            for (const line of lines) {
                // estorno = +qtyBase * quantity
                const refund = new library_1.Decimal(line.qtyBase)
                    .times(params.quantity)
                    .toDecimalPlaces(3);
                await this.inventory.applyStockMovement(tx, {
                    tenantId: params.tenantId,
                    inventoryItemId: line.inventoryItemId,
                    type: client_1.StockMovementType.ADJUSTMENT,
                    qtyDelta: refund,
                    relatedOrderId: params.orderId,
                    uniqueScopeKey: `${uniqueScopePrefix}:${line.inventoryItemId}`,
                    blockIfNegative: false, // estorno não precisa bloquear
                });
            }
            return { ok: true };
        });
    }
};
exports.InventoryEventsService = InventoryEventsService;
exports.InventoryEventsService = InventoryEventsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_service_1.InventoryService])
], InventoryEventsService);
