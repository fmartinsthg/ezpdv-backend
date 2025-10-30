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
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const library_1 = require("@prisma/client/runtime/library");
let InventoryService = class InventoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    q3(v) {
        return new library_1.Decimal(v).toDecimalPlaces(3);
    }
    // ====== Itens ======
    async listItems(tenantId, q) {
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
    async createItem(tenantId, dto) {
        const factor = this.q3(dto.factorToBase);
        if (factor.lte(0))
            throw new common_1.BadRequestException("factorToBase deve ser > 0");
        const onHand = this.q3(dto.onHand);
        if (onHand.lt(0))
            throw new common_1.BadRequestException("onHand deve ser >= 0");
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
        }
        catch (e) {
            if (e.code === "P2002")
                throw new common_1.ConflictException("Nome já existe neste tenant");
            throw e;
        }
    }
    async getItemDetail(tenantId, id) {
        const item = await this.prisma.inventoryItem.findFirst({
            where: { id, tenantId },
        });
        if (!item)
            throw new common_1.NotFoundException("Item não encontrado");
        const recentMovs = await this.prisma.stockMovement.findMany({
            where: { tenantId, inventoryItemId: id },
            orderBy: { createdAt: "desc" },
            take: 20,
        });
        // 🔧 RecipeLine NÃO possui tenantId nem productId no modelo.
        // Filtre por relação da Recipe (recipe: { tenantId }) e selecione productId via relation.
        const referencedLines = await this.prisma.recipeLine.findMany({
            where: { inventoryItemId: id, recipe: { tenantId } },
            select: {
                qtyBase: true,
                recipe: { select: { productId: true } },
            },
            take: 50,
        });
        const referencedBy = referencedLines.map((r) => ({
            productId: r.recipe.productId,
            qtyBase: r.qtyBase,
        }));
        return { item, recentMovs, referencedBy };
    }
    async updateItem(tenantId, id, dto) {
        const patch = {};
        if (dto.name)
            patch.name = dto.name.trim();
        if (dto.unit) {
            // 🔧 Conte linhas da receita referindo este item usando a relação recipe → tenantId
            const lines = await this.prisma.recipeLine.count({
                where: { inventoryItemId: id, recipe: { tenantId } },
            });
            if (lines > 0) {
                throw new common_1.ConflictException("Alterar unidade exigiria migração de receitas existentes");
            }
            patch.unit = dto.unit;
        }
        if (dto.factorToBase !== undefined) {
            const factor = this.q3(dto.factorToBase);
            if (factor.lte(0))
                throw new common_1.BadRequestException("factorToBase deve ser > 0");
            patch.factorToBase = factor;
        }
        if (dto.isIngredient !== undefined)
            patch.isIngredient = dto.isIngredient;
        try {
            return await this.prisma.inventoryItem.update({
                where: { id },
                data: patch,
            });
        }
        catch (e) {
            if (e.code === "P2002")
                throw new common_1.ConflictException("Nome já existe neste tenant");
            throw e;
        }
    }
    // ====== Movimentação atômica ======
    async applyStockMovement(tx, params) {
        const qtyDelta = this.q3(params.qtyDelta);
        const blockIfNegative = params.blockIfNegative !== false;
        // Row lock para evitar corrida
        await tx.$executeRawUnsafe(`SELECT id FROM "InventoryItem" WHERE id = $1 AND "tenantId" = $2 FOR UPDATE`, params.inventoryItemId, params.tenantId);
        const item = await tx.inventoryItem.findFirst({
            where: { id: params.inventoryItemId, tenantId: params.tenantId },
        });
        if (!item)
            throw new common_1.NotFoundException("Item não encontrado");
        const newOnHand = new library_1.Decimal(item.onHand)
            .plus(qtyDelta)
            .toDecimalPlaces(3);
        if (blockIfNegative && newOnHand.lt(0)) {
            throw new common_1.ConflictException("Saldo insuficiente para a operação");
        }
        // Idempotência interna por uniqueScopeKey
        if (params.uniqueScopeKey) {
            const exists = await tx.stockMovement.findFirst({
                where: { uniqueScopeKey: params.uniqueScopeKey },
                select: { id: true },
            });
            if (exists)
                return { idempotent: true };
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
    async adjustItem(tenantId, id, dto) {
        const reason = dto.reason ?? "adjustment";
        return this.prisma.$transaction(async (tx) => {
            const current = await tx.inventoryItem.findFirst({
                where: { id, tenantId },
            });
            if (!current)
                throw new common_1.NotFoundException("Item não encontrado");
            let delta;
            if (dto.newOnHand !== undefined) {
                delta = this.q3(dto.newOnHand).minus(current.onHand);
            }
            else if (dto.delta !== undefined) {
                delta = this.q3(dto.delta);
            }
            else {
                throw new common_1.BadRequestException("Informe newOnHand ou delta");
            }
            return this.applyStockMovement(tx, {
                tenantId,
                inventoryItemId: id,
                type: client_1.StockMovementType.ADJUSTMENT,
                qtyDelta: delta,
                reason,
                blockIfNegative: true,
            });
        });
    }
    // ====== Recipes ======
    async getRecipe(tenantId, productId) {
        const recipe = await this.prisma.recipe.findUnique({
            where: { productId },
            include: { lines: { orderBy: { inventoryItemId: "asc" } } },
        });
        if (!recipe || recipe.tenantId !== tenantId) {
            return { productId, tenantId, lines: [] };
        }
        return recipe;
    }
    async upsertRecipe(tenantId, productId, dto) {
        // valida duplicatas e qty > 0
        const seen = new Set();
        for (const l of dto.lines) {
            if (seen.has(l.inventoryItemId)) {
                throw new common_1.BadRequestException("Item duplicado na receita");
            }
            seen.add(l.inventoryItemId);
            if (this.q3(l.qtyBase).lte(0)) {
                throw new common_1.BadRequestException("qtyBase deve ser > 0");
            }
        }
        // valida existência dos itens no tenant
        const itemIds = dto.lines.map((l) => l.inventoryItemId);
        const count = await this.prisma.inventoryItem.count({
            where: { tenantId, id: { in: itemIds } },
        });
        if (count !== itemIds.length) {
            throw new common_1.BadRequestException("Algum inventoryItemId é inválido");
        }
        return this.prisma.$transaction(async (tx) => {
            // upsert da receita (1 por productId)
            const recipe = await tx.recipe.upsert({
                where: { productId },
                update: { tenantId },
                create: { productId, tenantId },
            });
            // 🔧 RecipeLine NÃO tem tenantId/productId — usa recipeId
            await tx.recipeLine.deleteMany({ where: { recipeId: recipe.id } });
            await tx.recipeLine.createMany({
                data: dto.lines.map((l) => ({
                    recipeId: recipe.id,
                    inventoryItemId: l.inventoryItemId,
                    qtyBase: this.q3(l.qtyBase),
                })),
            });
            return tx.recipe.findUnique({
                where: { productId },
                include: { lines: { orderBy: { inventoryItemId: "asc" } } },
            });
        });
    }
    // ====== Movements (query) ======
    async listMovements(tenantId, q) {
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
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryService);
