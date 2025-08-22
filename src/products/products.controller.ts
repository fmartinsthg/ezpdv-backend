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
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsQueryDto } from "./dto/products-query.dto";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthUser } from "../auth/jwt.strategy";

import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { TenantId } from "../common/tenant";

@ApiTags("products")
@ApiBearerAuth()
@ApiHeader({
  name: "X-Tenant-Id",
  description:
    "Obrigatório para SUPERADMIN operar sobre um tenant específico. Ignorado para ADMIN/MODERATOR/USER.",
  required: false,
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: "Listar produtos (paginado/filtrado)" })
  @ApiResponse({
    status: 200,
    description: "Lista de produtos retornada com sucesso.",
  })
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ProductsQueryDto
  ) {
    return this.productsService.findAll(tenantId, query);
  }

  @ApiOperation({ summary: "Obter produto por ID" })
  @ApiResponse({ status: 200, description: "Produto encontrado." })
  @ApiResponse({ status: 404, description: "Produto não encontrado." })
  @Get(":id")
  async findOne(
    @TenantId() tenantId: string,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    return this.productsService.findOne(tenantId, id);
  }

  @ApiOperation({ summary: "Criar produto" })
  @ApiResponse({ status: 201, description: "Produto criado." })
  @ApiResponse({ status: 404, description: "Categoria informada não existe." })
  @Roles("ADMIN", "MODERATOR")
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @TenantId() tenantId: string,
    @Body() data: CreateProductDto
  ) {
    return this.productsService.create(user, tenantId, data);
  }

  @ApiOperation({ summary: "Atualizar produto" })
  @ApiResponse({ status: 200, description: "Produto atualizado." })
  @ApiResponse({
    status: 404,
    description: "Produto ou categoria não encontrados.",
  })
  @Roles("ADMIN", "MODERATOR")
  @Patch(":id")
  async update(
    @CurrentUser() user: AuthUser,
    @TenantId() tenantId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() data: UpdateProductDto
  ) {
    return this.productsService.update(user, tenantId, id, data);
  }

  @ApiOperation({ summary: "Excluir produto" })
  @ApiResponse({ status: 200, description: "Produto excluído." })
  @ApiResponse({ status: 404, description: "Produto não encontrado." })
  @Roles("ADMIN", "MODERATOR")
  @Delete(":id")
  async delete(
    @CurrentUser() user: AuthUser,
    @TenantId() tenantId: string,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    return this.productsService.delete(user, tenantId, id);
  }
}
