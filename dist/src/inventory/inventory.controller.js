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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
// src/inventory/inventory.controller.ts
const common_1 = require("@nestjs/common");
const inventory_service_1 = require("./inventory.service");
const create_inventory_item_dto_1 = require("./dto/create-inventory-item.dto");
const update_inventory_item_dto_1 = require("./dto/update-inventory-item.dto");
const adjust_inventory_item_dto_1 = require("./dto/adjust-inventory-item.dto");
const upsert_recipe_dto_1 = require("./dto/upsert-recipe.dto");
const list_items_dto_1 = require("./dto/list-items.dto");
const list_movements_dto_1 = require("./dto/list-movements.dto");
// ⬇️ padronizado
const roles_decorator_1 = require("../common/decorators/roles.decorator");
// Idempotência + Swagger
const idempotency_decorator_1 = require("../common/idempotency/idempotency.decorator");
const swagger_1 = require("@nestjs/swagger");
let InventoryController = class InventoryController {
    constructor(inventory) {
        this.inventory = inventory;
    }
    async listItems(tenantId, q) {
        return this.inventory.listItems(tenantId, q);
    }
    async createItem(tenantId, dto) {
        return this.inventory.createItem(tenantId, dto);
    }
    async getItem(tenantId, id) {
        return this.inventory.getItemDetail(tenantId, id);
    }
    async updateItem(tenantId, id, dto) {
        return this.inventory.updateItem(tenantId, id, dto);
    }
    async adjustItem(tenantId, id, dto) {
        return this.inventory.adjustItem(tenantId, id, dto);
    }
    async getRecipe(tenantId, productId) {
        return this.inventory.getRecipe(tenantId, productId);
    }
    async upsertRecipe(tenantId, productId, dto) {
        return this.inventory.upsertRecipe(tenantId, productId, dto);
    }
    async listMovements(tenantId, q) {
        return this.inventory.listMovements(tenantId, q);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, common_1.Get)("inventory/items"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_items_dto_1.ListItemsDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "listItems", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Criar item de inventário (idempotente)" }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Key",
        required: true,
        description: "UUID v4 por request",
    }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "inventory:create-item",
    }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, idempotency_decorator_1.Idempotent)(["inventory:create-item", "inventory:items:create"]),
    (0, common_1.Post)("inventory/items"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_inventory_item_dto_1.CreateInventoryItemDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "createItem", null);
__decorate([
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, common_1.Get)("inventory/items/:id"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getItem", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Atualizar item de inventário (idempotente)" }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "inventory:update-item",
    }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, idempotency_decorator_1.Idempotent)(["inventory:update-item", "inventory:items:update"]),
    (0, common_1.Patch)("inventory/items/:id"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_inventory_item_dto_1.UpdateInventoryItemDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "updateItem", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Ajustar saldo de item (idempotente)" }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "inventory:adjust-item",
    }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, idempotency_decorator_1.Idempotent)(["inventory:adjust-item", "inventory:items:adjust"]),
    (0, common_1.Post)("inventory/items/:id/adjust"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("id")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, adjust_inventory_item_dto_1.AdjustInventoryItemDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "adjustItem", null);
__decorate([
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, common_1.Get)("recipes/:productId"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("productId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getRecipe", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Upsert de receita (idempotente)" }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "inventory:upsert-recipe",
    }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, idempotency_decorator_1.Idempotent)(["inventory:upsert-recipe", "inventory:recipes:upsert"]),
    (0, common_1.Put)("recipes/:productId"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("productId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, upsert_recipe_dto_1.UpsertRecipeDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "upsertRecipe", null);
__decorate([
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, common_1.Get)("inventory/movements"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_movements_dto_1.ListMovementsDto]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "listMovements", null);
exports.InventoryController = InventoryController = __decorate([
    (0, swagger_1.ApiTags)("inventory"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("tenants/:tenantId"),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
