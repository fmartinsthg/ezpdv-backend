// src/products/products.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsQueryDto } from './dto/products-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthUser } from '../auth/jwt.strategy';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * SUPERADMIN é superuser (pode gerenciar tudo)
   * ADMIN / MODERATOR também podem gerenciar.
   */
  private canManage(user: AuthUser): boolean {
    const sys = user?.systemRole ? String(user.systemRole).toUpperCase() : '';
    if (sys === 'SUPERADMIN') return true;
    const r = user?.role ? String(user.role).toUpperCase() : '';
    return r === 'ADMIN' || r === 'MODERATOR';
  }

  async findAll(tenantId: string, query: ProductsQueryDto) {
    const {
      q,
      categoryId,
      isActive,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 10,
    } = query;

    const take = Math.min(Number(limit) || 10, 100);
    const skip = (Number(page) - 1) * take;

    const where: Prisma.ProductWhereInput = { tenantId };

    // busca textual
    if (q && q.trim().length > 0) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      ];
    }

    // filtro por categoria
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // filtro por ativo
    if (isActive !== undefined) {
      if (typeof isActive === 'boolean') {
        where.isActive = isActive;
      } else if (typeof isActive === 'string') {
        where.isActive = isActive.toLowerCase() === 'true';
      }
    }

    // ordenação
    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      page: Number(page),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
      sortBy,
      sortOrder,
    };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async create(user: AuthUser, tenantId: string, data: CreateProductDto) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Sem permissão para criar produtos.');
    }

    // valida categoria dentro do tenant (se enviada)
    if (data.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: data.categoryId, tenantId },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException(
          'Categoria não encontrada para este restaurante.',
        );
      }
    }

    try {
      return await this.prisma.product.create({
        data: {
          tenantId, // obrigatório no multi-tenant
          name: data.name,
          description: data.description,
          price: new Prisma.Decimal(
            typeof data.price === 'string' ? data.price : String(data.price),
          ),
        // `cost` é opcional em alguns contextos — ajuste conforme seu DTO
          cost:
            data.cost !== undefined
              ? new Prisma.Decimal(
                  typeof data.cost === 'string' ? data.cost : String(data.cost),
                )
              : new Prisma.Decimal('0'),
          stock: data.stock,
          categoryId: data.categoryId,
          isActive: true,
        },
        include: { category: { select: { id: true, name: true } } },
      });
    } catch (err: any) {
      if (err.code === '22P02') {
        throw new BadRequestException('IDs devem ser UUIDs válidos.');
      }
      if (err.code === 'P2003') {
        throw new NotFoundException('Categoria informada não existe.');
      }
      if (err.code === 'P2002') {
        // unique (tenantId, name) ou (tenantId, barcode)
        throw new BadRequestException('Dados duplicados para este restaurante.');
      }
      throw err;
    }
  }

  async update(
    user: AuthUser,
    tenantId: string,
    id: string,
    data: UpdateProductDto,
  ) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Sem permissão para atualizar produtos.');
    }

    // garante escopo (existe no tenant)
    await this.findOne(tenantId, id);

    // valida nova categoria (se informada)
    if (data.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: data.categoryId, tenantId },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException(
          'Categoria informada não existe neste restaurante.',
        );
      }
    }

    try {
      const payload: Prisma.ProductUpdateInput = {
        name: data.name,
        description: data.description,
        stock: data.stock,
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      };

      if (data.categoryId !== undefined) {
        payload.category = data.categoryId
          ? { connect: { id: data.categoryId } }
          : { disconnect: true };
      }

      if (data.price !== undefined) {
        payload.price = new Prisma.Decimal(
          typeof data.price === 'string' ? data.price : String(data.price),
        );
      }
      if (data.cost !== undefined) {
        payload.cost = new Prisma.Decimal(
          typeof data.cost === 'string' ? data.cost : String(data.cost),
        );
      }

      return await this.prisma.product.update({
        where: { id },
        data: payload,
        include: { category: { select: { id: true, name: true } } },
      });
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw new NotFoundException('Produto não encontrado');
      }
      if (err.code === '22P02') {
        throw new BadRequestException('IDs devem ser UUIDs válidos.');
      }
      if (err.code === 'P2003') {
        throw new NotFoundException('Categoria informada não existe.');
      }
      if (err.code === 'P2002') {
        throw new BadRequestException('Dados duplicados para este restaurante.');
      }
      throw err;
    }
  }

  async delete(user: AuthUser, tenantId: string, id: string) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Sem permissão para remover produtos.');
    }

    // garante escopo (existe no tenant)
    await this.findOne(tenantId, id);

    try {
      return await this.prisma.product.delete({ where: { id } });
    } catch (err: any) {
      if (err.code === 'P2025') {
        throw new NotFoundException('Produto não encontrado');
      }
      if (err.code === '22P02') {
        throw new BadRequestException('ID deve ser um UUID válido.');
      }
      throw err;
    }
  }
}
