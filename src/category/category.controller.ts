import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  ParseUUIDPipe,
  Headers,
} from "@nestjs/common";
import { CategoryService } from "./category.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CategoryPaginationDto } from "./dto/pagination-category.dto";
import { SearchCategoryDto } from "./dto/search-category.dto";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthUser } from "../auth/jwt.strategy";
import { resolveEffectiveTenantId } from "../common/tenant/tenant.util";

@UseGuards(JwtAuthGuard)
@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // Listagem simples
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.findAll(tenantId);
  }

  // Listagem paginada
  @Get("paginated")
  async findAllPaginated(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Query() paginationDto: CategoryPaginationDto
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.findAllPaginated(tenantId, paginationDto);
  }

  @Get(":id")
  async findOne(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.findOne(tenantId, id);
  }

  @Get(":id/products")
  async findWithProducts(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.findWithProducts(tenantId, id);
  }

  @Get("active/with-count")
  async getActiveCategoriesWithProductCount(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.getActiveCategoriesWithProductCount(
      tenantId
    );
  }

  @Post()
  @Roles("ADMIN", "MODERATOR")
  @UseGuards(RolesGuard)
  async create(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Body() data: CreateCategoryDto
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.create(user, tenantId, data);
  }

  @Patch(":id")
  @Roles("ADMIN", "MODERATOR")
  @UseGuards(RolesGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() data: UpdateCategoryDto
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.update(tenantId, id, data);
  }

  // Status
  @Patch(":id/deactivate")
  @Roles("ADMIN", "MODERATOR")
  @UseGuards(RolesGuard)
  async deactivate(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.deactivate(tenantId, id);
  }

  @Patch(":id/activate")
  @Roles("ADMIN", "MODERATOR")
  @UseGuards(RolesGuard)
  async activate(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.activate(tenantId, id);
  }

  // Busca
  @Get("search")
  async search(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Query() searchCategoryDto: SearchCategoryDto
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.search(tenantId, searchCategoryDto);
  }

  // Exclusão
  @Delete(":id")
  @Roles("ADMIN")
  @UseGuards(RolesGuard)
  async delete(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.delete(tenantId, id);
  }

  @Delete(":id/safe")
  @Roles("ADMIN")
  @UseGuards(RolesGuard)
  async deleteSafe(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.deleteSafe(tenantId, id);
  }

  // Hierarquia
  @Get(":id/subcategories")
  async findSubcategories(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.findSubcategories(tenantId, id);
  }

  @Get("hierarchy")
  async getCategoryHierarchy(
    @CurrentUser() user: AuthUser,
    @Headers() headers: Record<string, string>
  ) {
    const tenantId = resolveEffectiveTenantId(user, headers["x-tenant-id"]);
    return await this.categoryService.getCategoryHierarchy(tenantId);
  }
}
