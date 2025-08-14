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
} from "@nestjs/common";
import { CategoryService } from "./category.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { PaginationDto } from "./dto/pagination.dto";
import { SearchCategoryDto } from "./dto/search-category.dto";

@Controller("categories")
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // Basic CRUD Operations
  @Get()
  async findAll() {
    return await this.categoryService.findAll();
  }

  @Get("paginated")
  async findAllPaginated(@Query() paginationDto: PaginationDto) {
    return await this.categoryService.findAllPaginated(paginationDto);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return await this.categoryService.findOne(id);
  }

  @Get(":id/products")
  async findWithProducts(@Param("id") id: string) {
    return await this.categoryService.findWithProducts(id);
  }

  @Get("active/with-count")
  async getActiveCategoriesWithProductCount() {
    return await this.categoryService.getActiveCategoriesWithProductCount();
  }

  @Post()
  @Roles("ADMIN", "MODERATOR")
  @UseGuards(RolesGuard)
  async create(@Body() data: CreateCategoryDto) {
    return await this.categoryService.create(data);
  }

  @Patch(":id")
  @Roles("ADMIN", "MODERATOR")
  @UseGuards(RolesGuard)
  async update(@Param("id") id: string, @Body() data: UpdateCategoryDto) {
    return await this.categoryService.update(id, data);
  }

  // Status Management
  @Patch(":id/deactivate")
  @Roles("ADMIN", "MODERATOR")
  @UseGuards(RolesGuard)
  async deactivate(@Param("id") id: string) {
    return await this.categoryService.deactivate(id);
  }

  @Patch(":id/activate")
  @Roles("ADMIN", "MODERATOR")
  @UseGuards(RolesGuard)
  async activate(@Param("id") id: string) {
    return await this.categoryService.activate(id);
  }

  // Search Operations
  @Get("search")
  async search(@Query() searchCategoryDto: SearchCategoryDto) {
    return await this.categoryService.search(searchCategoryDto);
  }

  // Delete Operations
  @Delete(":id")
  @Roles("ADMIN")
  @UseGuards(RolesGuard)
  async delete(@Param("id") id: string) {
    return await this.categoryService.delete(id);
  }

  @Delete(":id/safe")
  @Roles("ADMIN")
  @UseGuards(RolesGuard)
  async deleteSafe(@Param("id") id: string) {
    return await this.categoryService.deleteSafe(id);
  }

  // Hierarchy Support (if needed)
  @Get(":id/subcategories")
  async findSubcategories(@Param("id") id: string) {
    return await this.categoryService.findSubcategories(id);
  }

  @Get("hierarchy")
  async getCategoryHierarchy() {
    return await this.categoryService.getCategoryHierarchy();
  }
}