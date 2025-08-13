import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany();
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException("Produto não encontrado");
    return product;
  }

  async create(data: CreateProductDto) {
    return this.prisma.product.create({ data });
  }

  async update(id: string, data: UpdateProductDto) {
    return this.prisma.product.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
