import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany({
      include: { category: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!product) throw new NotFoundException("Produto não encontrado");
    return product;
  }

  async create(data: CreateProductDto) {
    // 1) Confirma existência da categoria
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new NotFoundException("Categoria não encontrada para o produto");
    }

    try {
      // Converte price e cost para number se vierem como string
      const price =
        typeof data.price === "string" ? parseFloat(data.price) : data.price;
      const cost =
        typeof data.cost === "string" ? parseFloat(data.cost) : data.cost;

      return await this.prisma.product.create({
        data: {
          name: data.name,
          description: data.description,
          price,
          cost,
          stock: data.stock,
          categoryId: data.categoryId,
        },
        include: { category: { select: { id: true, name: true } } },
      });
    } catch (err: any) {
      // Postgres: UUID inválido em algum campo
      if (err.code === "22P02") {
        throw new BadRequestException("IDs devem ser UUIDs válidos.");
      }
      // Prisma: Violação de FK (categoria inexistente)
      if (err.code === "P2003") {
        throw new NotFoundException("Categoria informada não existe.");
      }
      // Prisma: Unique, etc
      if (err.code === "P2002") {
        throw new BadRequestException("Dados duplicados para produto.");
      }
      throw err;
    }
  }

  async update(id: string, data: UpdateProductDto) {
    // Se vier troca de categoria, valida primeiro
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category)
        throw new NotFoundException("Categoria informada não existe.");
    }

    try {
      const payload: Prisma.ProductUpdateInput = {
        name: data.name,
        description: data.description,
        stock: data.stock,
      };
      if (data.categoryId) {
        payload.category = { connect: { id: data.categoryId } };
      }
      if (data.price !== undefined) {
        payload.price = Number(data.price);
      }
      if (data.cost !== undefined) {
        payload.cost = Number(data.cost);
      }

      return await this.prisma.product.update({
        where: { id },
        data: payload,
        include: { category: { select: { id: true, name: true } } },
      });
    } catch (err: any) {
      if (err.code === "P2025")
        throw new NotFoundException("Produto não encontrado");
      if (err.code === "22P02")
        throw new BadRequestException("IDs devem ser UUIDs válidos.");
      if (err.code === "P2003")
        throw new NotFoundException("Categoria informada não existe.");
      throw err;
    }
  }

  async delete(id: string) {
    try {
      return await this.prisma.product.delete({ where: { id } });
    } catch (err: any) {
      if (err.code === "P2025")
        throw new NotFoundException("Produto não encontrado");
      if (err.code === "22P02")
        throw new BadRequestException("ID deve ser um UUID válido.");
      throw err;
    }
  }
}
