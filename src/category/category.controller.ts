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
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from './dto/pagination.dto';
import { SearchCategoryDto } from './dto/search-category.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // Basic CRUD Operations
  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    return await this.categoryService.findAll(user);
  }

  @Get('paginated')
  async findAllPaginated(
    @CurrentUser() user: AuthUser,
    @Query() paginationDto: PaginationDto,
  ) {
    const page = Number(paginationDto.page ?? 1);
    const limit = Math.min(Number(paginationDto.limit ?? 10), 100);
    const sortBy = (paginationDto.sortBy as 'name' | 'createdAt' | 'updatedAt') ?? 'name';
    const sortOrder = (paginationDto.sortOrder as 'asc' | 'desc') ?? 'asc';

    return await this.categoryService.findAllPaginated(user, {
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return await this.categoryService.findOne(user, id);
  }

  @Get(':id/products')
  async findWithProducts(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return await this.categoryService.findWithProducts(user, id);
  }

  @Get('active/with-count')
  async getActiveCategoriesWithProductCount(@CurrentUser() user: AuthUser) {
    return await this.categoryService.getActiveCategoriesWithProductCount(user);
  }

  @Post()
  @Roles('ADMIN', 'MODERATOR')
  @UseGuards(RolesGuard)
  async create(@CurrentUser() user: AuthUser, @Body() data: CreateCategoryDto) {
    return await this.categoryService.create(user, data);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MODERATOR')
  @UseGuards(RolesGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() data: UpdateCategoryDto,
  ) {
    return await this.categoryService.update(user, id, data);
  }

  // Status Management
  @Patch(':id/deactivate')
  @Roles('ADMIN', 'MODERATOR')
  @UseGuards(RolesGuard)
  async deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return await this.categoryService.deactivate(user, id);
  }

  @Patch(':id/activate')
  @Roles('ADMIN', 'MODERATOR')
  @UseGuards(RolesGuard)
  async activate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return await this.categoryService.activate(user, id);
  }

  // Search Operations
  @Get('search')
  async search(
    @CurrentUser() user: AuthUser,
    @Query() searchCategoryDto: SearchCategoryDto,
  ) {
    return await this.categoryService.search(user, searchCategoryDto);
  }

  // Delete Operations
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return await this.categoryService.delete(user, id);
  }

  @Delete(':id/safe')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async deleteSafe(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return await this.categoryService.deleteSafe(user, id);
  }

  // Hierarchy Support
  @Get(':id/subcategories')
  async findSubcategories(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return await this.categoryService.findSubcategories(user, id);
  }

  @Get('hierarchy')
  async getCategoryHierarchy(@CurrentUser() user: AuthUser) {
    return await this.categoryService.getCategoryHierarchy(user);
  }
}