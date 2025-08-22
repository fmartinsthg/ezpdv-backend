import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ativas + contagem de produtos ativos por categoria (no mesmo tenant) */
  async getActiveCategoriesWithProductCount(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const results = await Promise.all(
      categories.map(async (category) => {
        const productCount = await this.prisma.product.count({
          where: {
            categoryId: category.id,
            tenantId,
            isActive: true,
          },
        });
        return { ...category, productCount };
      }),
    );
    return results;
  }

  /* =========================
   *        LISTAGEM
   * ========================= */

  async findAll(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAllPaginated(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      sortBy?: 'name' | 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const page = Number(params.page ?? 1);
    const take = Math.min(Number(params.limit ?? 10), 100);
    const skip = (page - 1) * take;
    const sortBy = params.sortBy ?? 'name';
    const sortOrder = params.sortOrder ?? 'asc';

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where: { tenantId },
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.category.count({ where: { tenantId } }),
    ]);

    return {
      categories,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async findOne(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  async findWithProducts(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        products: {
          where: { tenantId },
          select: {
            id: true,
            name: true,
            price: true,
            stock: true,
            barcode: true,
            isActive: true,
          },
        },
      },
    });

    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  /* =========================
   *        CRUD
   * ========================= */

  async create(tenantId: string, data: CreateCategoryDto) {
    const exists = await this.prisma.category.findUnique({
      where: { tenantId_name: { tenantId, name: data.name } },
      select: { id: true },
    });
    if (exists) {
      throw new BadRequestException(
        'Já existe uma categoria com este nome neste restaurante',
      );
    }

    try {
      return await this.prisma.category.create({
        data: {
          name: data.name,
          description: data.description,
          isActive: true,
          tenant: { connect: { id: tenantId } },
          ...(data.parentId && { parent: { connect: { id: data.parentId } } }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (
        error.code === 'P2002' &&
        error.meta?.target?.includes('tenantId_name')
      ) {
        throw new ConflictException(
          'Já existe uma categoria com este nome neste restaurante.',
        );
      }
      if (error.code === 'P2003') {
        // FK inválida (ex.: parentId não existe no tenant)
        throw new BadRequestException('Categoria pai inválida.');
      }
      if (error.code === '22P02') {
        // UUID inválido
        throw new BadRequestException('IDs devem ser UUIDs válidos.');
      }
      throw error;
    }
  }

  async update(tenantId: string, id: string, data: UpdateCategoryDto) {
    // Garante existência e escopo
    const existing = await this.prisma.category.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundException('Categoria não encontrada');

    // Se trocar o nome, valida unicidade por tenant
    if (data.name && data.name !== existing.name) {
      const nameExists = await this.prisma.category.findUnique({
        where: {
          tenantId_name: { tenantId, name: data.name },
        },
        select: { id: true },
      });
      if (nameExists) {
        throw new BadRequestException(
          'Já existe uma categoria com este nome neste restaurante',
        );
      }
    }

    // parentId: conectar, desconectar (null), ou manter (undefined)
    const parentData =
      data.parentId === undefined
        ? {}
        : data.parentId === null
        ? { parent: { disconnect: true } }
        : { parent: { connect: { id: data.parentId } } };

    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          ...parentData,
        },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (
        error.code === 'P2002' &&
        error.meta?.target?.includes('tenantId_name')
      ) {
        throw new ConflictException(
          'Já existe uma categoria com este nome neste restaurante.',
        );
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Categoria não encontrada');
      }
      if (error.code === '22P02') {
        throw new BadRequestException('IDs devem ser UUIDs válidos.');
      }
      throw error;
    }
  }

  /* =========================
   *        STATUS
   * ========================= */

  async deactivate(tenantId: string, id: string) {
    // garante escopo/existência no tenant
    await this.findOne(tenantId, id);
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Categoria não encontrada');
      }
      if (error.code === '22P02') {
        throw new BadRequestException('IDs devem ser UUIDs válidos.');
      }
      throw error;
    }
  }

  async activate(tenantId: string, id: string) {
    // garante escopo/existência no tenant
    await this.findOne(tenantId, id);
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Categoria não encontrada');
      }
      if (error.code === '22P02') {
        throw new BadRequestException('IDs devem ser UUIDs válidos.');
      }
      throw error;
    }
  }

  /* =========================
   *        EXCLUSÃO
   * ========================= */

  async delete(tenantId: string, id: string) {
    // valida escopo
    await this.findOne(tenantId, id);
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Categoria não encontrada');
      }
      throw error;
    }
  }

  async deleteSafe(tenantId: string, id: string) {
    // valida escopo
    await this.findOne(tenantId, id);

    // Checa se tem produtos no mesmo tenant
    const productCount = await this.prisma.product.count({
      where: { categoryId: id, tenantId, isActive: true },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        'Não é possível excluir uma categoria que contém produtos',
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }

  /* =========================
   *        BUSCAS
   * ========================= */

  async findByName(tenantId: string, name: string) {
    return this.prisma.category.findUnique({
      where: { tenantId_name: { tenantId, name } },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async search(
    tenantId: string,
    params: {
      name?: string;
      description?: string;
      exactMatch?: boolean;
      isActive?: boolean;
    },
  ) {
    const { name, description, exactMatch = false, isActive } = params;

    const where: any = { tenantId };

    if (name) {
      where.name = exactMatch ? name : { contains: name, mode: 'insensitive' };
    }

    if (description) {
      where.description = exactMatch
        ? description
        : { contains: description, mode: 'insensitive' };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /* =========================
   *       HIERARQUIA
   * ========================= */

  async findSubcategories(tenantId: string, parentId: string) {
    return this.prisma.category.findMany({
      where: { tenantId, parentId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getCategoryHierarchy(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });

    type CategoryNode = (typeof categories)[number] & {
      children: CategoryNode[];
    };

    const buildTree = (parentId: string | null = null): CategoryNode[] => {
      return categories
        .filter((category) => category.parentId === parentId)
        .map((category) => ({
          ...category,
          children: buildTree(category.id),
        }));
    };

    return buildTree();
  }
}
