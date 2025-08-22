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
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryPaginationDto } from './dto/pagination-category.dto';
import { SearchCategoryDto } from './dto/search-category.dto';

import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

// Consome o tenant resolvido pelo Guard global
import { TenantId } from '../common/tenant';

@ApiTags('categories')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Tenant-Id',
  description:
    'Obrigatório para SUPERADMIN operar sobre um tenant específico. Ignorado para ADMIN/MODERATOR/USER.',
  required: false,
})
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // Listagem simples
  @Get()
  async findAll(@TenantId() tenantId: string) {
    return await this.categoryService.findAll(tenantId);
  }

  // Listagem paginada
  @Get('paginated')
  async findAllPaginated(
    @TenantId() tenantId: string,
    @Query() paginationDto: CategoryPaginationDto,
  ) {
    return await this.categoryService.findAllPaginated(tenantId, paginationDto);
  }

  @Get(':id')
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return await this.categoryService.findOne(tenantId, id);
  }

  @Get(':id/products')
  async findWithProducts(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return await this.categoryService.findWithProducts(tenantId, id);
  }

  @Get('active/with-count')
  async getActiveCategoriesWithProductCount(@TenantId() tenantId: string) {
    return await this.categoryService.getActiveCategoriesWithProductCount(
      tenantId,
    );
  }

  @Post()
  @Roles('ADMIN', 'MODERATOR')
  @UseGuards(RolesGuard)
  async create(
    @TenantId() tenantId: string,
    @Body() data: CreateCategoryDto,
  ) {
    return await this.categoryService.create(tenantId, data);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MODERATOR')
  @UseGuards(RolesGuard)
  async update(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() data: UpdateCategoryDto,
  ) {
    // <<<<<< ERRO QUE VOCÊ VIA: aqui faltava o "data"
    return await this.categoryService.update(tenantId, id, data);
  }

  // Status
  @Patch(':id/deactivate')
  @Roles('ADMIN', 'MODERATOR')
  @UseGuards(RolesGuard)
  async deactivate(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return await this.categoryService.deactivate(tenantId, id);
  }

  @Patch(':id/activate')
  @Roles('ADMIN', 'MODERATOR')
  @UseGuards(RolesGuard)
  async activate(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return await this.categoryService.activate(tenantId, id);
  }

  // Busca
  @Get('search')
  async search(
    @TenantId() tenantId: string,
    @Query() searchCategoryDto: SearchCategoryDto,
  ) {
    return await this.categoryService.search(tenantId, searchCategoryDto);
  }

  // Exclusão
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async delete(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return await this.categoryService.delete(tenantId, id);
  }

  @Delete(':id/safe')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async deleteSafe(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return await this.categoryService.deleteSafe(tenantId, id);
  }

  // Hierarquia
  @Get(':id/subcategories')
  async findSubcategories(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return await this.categoryService.findSubcategories(tenantId, id);
  }

  @Get('hierarchy')
  async getCategoryHierarchy(@TenantId() tenantId: string) {
    return await this.categoryService.getCategoryHierarchy(tenantId);
  }
}
