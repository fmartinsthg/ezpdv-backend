import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll() {
    return await this.productsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return await this.productsService.findOne(id);
  }

  @Post()
  async create(@Body() data: CreateProductDto) {
    return await this.productsService.create(data);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() data: UpdateProductDto) {
    return await this.productsService.update(id, data);
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    return await this.productsService.delete(id);
  }
}
