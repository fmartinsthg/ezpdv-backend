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
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

// (Opcional, mas recomendado) – documentação
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

// Proteção por roles (seu projeto já criou esses utilitários antes)
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";

@ApiTags("products")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: "Listar produtos" })
  @ApiResponse({
    status: 200,
    description: "Lista de produtos retornada com sucesso.",
  })
  @Get()
  async findAll() {
    return this.productsService.findAll();
  }

  @ApiOperation({ summary: "Obter produto por ID" })
  @ApiResponse({ status: 200, description: "Produto encontrado." })
  @ApiResponse({ status: 404, description: "Produto não encontrado." })
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.productsService.findOne(id);
  }

  @ApiOperation({ summary: "Criar produto" })
  @ApiResponse({ status: 201, description: "Produto criado." })
  @ApiResponse({ status: 404, description: "Categoria informada não existe." })
  @Roles("ADMIN", "MODERATOR")
  @Post()
  async create(@Body() data: CreateProductDto) {
    return this.productsService.create(data);
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
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() data: UpdateProductDto
  ) {
    return this.productsService.update(id, data);
  }

  @ApiOperation({ summary: "Excluir produto" })
  @ApiResponse({ status: 200, description: "Produto excluído." })
  @ApiResponse({ status: 404, description: "Produto não encontrado." })
  @Roles("ADMIN", "MODERATOR")
  @Delete(":id")
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.productsService.delete(id);
  }
}
