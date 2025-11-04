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
  UseGuards,
  Req,
} from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { AdjustInventoryItemDto } from "./dto/adjust-inventory-item.dto";
import { UpsertRecipeDto } from "./dto/upsert-recipe.dto";
import { ListItemsDto } from "./dto/list-items.dto";
import { ListMovementsDto } from "./dto/list-movements.dto";

import { Roles } from "../auth/roles.decorator";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { TenantContextGuard } from "../common/tenant/tenant-context.guard";

@UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard)
@Controller("tenants/:tenantId")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("inventory/items")
  async listItems(
    @Param("tenantId") tenantId: string,
    @Query() q: ListItemsDto
  ) {
    return this.inventory.listItems(tenantId, q);
  }

  @Post("inventory/items")
  @Roles("ADMIN", "MODERATOR")
  async createItem(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateInventoryItemDto
  ) {
    return this.inventory.createItem(tenantId, dto);
  }

  @Get("inventory/items/:id")
  async getItem(@Param("tenantId") tenantId: string, @Param("id") id: string) {
    return this.inventory.getItemDetail(tenantId, id);
  }

  @Patch("inventory/items/:id")
  @Roles("ADMIN", "MODERATOR")
  async updateItem(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto
  ) {
    return this.inventory.updateItem(tenantId, id, dto);
  }

  @Post("inventory/items/:id/adjust")
  @Roles("ADMIN", "MODERATOR")
  async adjustItem(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() dto: AdjustInventoryItemDto
  ) {
    return this.inventory.adjustItem(tenantId, id, dto);
  }

  @Get("recipes/:productId")
  async getRecipe(
    @Param("tenantId") tenantId: string,
    @Param("productId") productId: string
  ) {
    return this.inventory.getRecipe(tenantId, productId);
  }

  @Put("recipes/:productId")
  @Roles("ADMIN", "MODERATOR")
  async upsertRecipe(
    @Param("tenantId") tenantId: string,
    @Param("productId") productId: string,
    @Body() dto: UpsertRecipeDto
  ) {
    return this.inventory.upsertRecipe(tenantId, productId, dto);
  }

  @Get("inventory/movements")
  async listMovements(
    @Param("tenantId") tenantId: string,
    @Query() q: ListMovementsDto
  ) {
    return this.inventory.listMovements(tenantId, q);
  }
}
