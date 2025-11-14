// src/inventory/inventory.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { AdjustInventoryItemDto } from "./dto/adjust-inventory-item.dto";
import { UpsertRecipeDto } from "./dto/upsert-recipe.dto";
import { ListItemsDto } from "./dto/list-items.dto";
import { ListMovementsDto } from "./dto/list-movements.dto";

// ⬇️ padronizado
import { Roles } from "../common/decorators/roles.decorator";

// Idempotência + Swagger
import {
  Idempotent,
  IDEMPOTENCY_FORBIDDEN,
} from "../common/idempotency/idempotency.decorator";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("inventory")
@ApiBearerAuth()
@Controller("tenants/:tenantId")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @Get("inventory/items")
  async listItems(
    @Param("tenantId") tenantId: string,
    @Query() q: ListItemsDto
  ) {
    return this.inventory.listItems(tenantId, q);
  }

  @ApiOperation({ summary: "Criar item de inventário (idempotente)" })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "UUID v4 por request",
  })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "inventory:create-item",
  })
  @Roles("ADMIN", "MODERATOR")
  @Idempotent(["inventory:create-item", "inventory:items:create"])
  @Post("inventory/items")
  async createItem(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateInventoryItemDto
  ) {
    return this.inventory.createItem(tenantId, dto);
  }

  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @Get("inventory/items/:id")
  async getItem(@Param("tenantId") tenantId: string, @Param("id") id: string) {
    return this.inventory.getItemDetail(tenantId, id);
  }

  @ApiOperation({ summary: "Atualizar item de inventário (idempotente)" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "inventory:update-item",
  })
  @Roles("ADMIN", "MODERATOR")
  @Idempotent(["inventory:update-item", "inventory:items:update"])
  @Patch("inventory/items/:id")
  async updateItem(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto
  ) {
    return this.inventory.updateItem(tenantId, id, dto);
  }

  @ApiOperation({ summary: "Ajustar saldo de item (idempotente)" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "inventory:adjust-item",
  })
  @Roles("ADMIN", "MODERATOR")
  @Idempotent(["inventory:adjust-item", "inventory:items:adjust"])
  @Post("inventory/items/:id/adjust")
  async adjustItem(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: AdjustInventoryItemDto
  ) {
    return this.inventory.adjustItem(tenantId, id, dto);
  }

  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @Get("recipes/:productId")
  async getRecipe(
    @Param("tenantId") tenantId: string,
    @Param("productId") productId: string
  ) {
    return this.inventory.getRecipe(tenantId, productId);
  }

  @ApiOperation({ summary: "Upsert de receita (idempotente)" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "inventory:upsert-recipe",
  })
  @Roles("ADMIN", "MODERATOR")
  @Idempotent(["inventory:upsert-recipe", "inventory:recipes:upsert"])
  @Put("recipes/:productId")
  async upsertRecipe(
    @Param("tenantId") tenantId: string,
    @Param("productId") productId: string,
    @Body() dto: UpsertRecipeDto
  ) {
    return this.inventory.upsertRecipe(tenantId, productId, dto);
  }

  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @Get("inventory/movements")
  async listMovements(
    @Param("tenantId") tenantId: string,
    @Query() q: ListMovementsDto
  ) {
    return this.inventory.listMovements(tenantId, q);
  }
}
