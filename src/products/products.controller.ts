// src/products/products.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';

// Swagger (opcional)
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

// Roles (use o caminho que você já está usando no projeto)
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Listar produtos (paginado/filtrado)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de produtos retornada com sucesso.',
  })
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ProductsQueryDto,
  ) {
    return this.productsService.findAll(user, query);
  }

  @ApiOperation({ summary: 'Obter produto por ID' })
  @ApiResponse({ status: 200, description: 'Produto encontrado.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.productsService.findOne(user, id);
  }

  @ApiOperation({ summary: 'Criar produto' })
  @ApiResponse({ status: 201, description: 'Produto criado.' })
  @ApiResponse({ status: 404, description: 'Categoria informada não existe.' })
  @Roles('ADMIN', 'MODERATOR')
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() data: CreateProductDto,
  ) {
    return this.productsService.create(user, data);
  }

  @ApiOperation({ summary: 'Atualizar produto' })
  @ApiResponse({ status: 200, description: 'Produto atualizado.' })
  @ApiResponse({
    status: 404,
    description: 'Produto ou categoria não encontrados.',
  })
  @Roles('ADMIN', 'MODERATOR')
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() data: UpdateProductDto,
  ) {
    return this.productsService.update(user, id, data);
  }

  @ApiOperation({ summary: 'Excluir produto' })
  @ApiResponse({ status: 200, description: 'Produto excluído.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  @Roles('ADMIN', 'MODERATOR')
  @Delete(':id')
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.productsService.delete(user, id);
  }
}
