import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  // Basic CRUD Operations
  async findAll() {
    return this.prisma.category.findMany({
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

  async findAllPaginated(params: {
    page?: number;
    limit?: number;
    sortBy?: "name" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
  }) {
    const { page = 1, limit = 10, sortBy = "name", sortOrder = "asc" } = params;
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        skip,
        take: limit,
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
      this.prisma.category.count(),
    ]);

    return {
      categories,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!category) throw new NotFoundException("Categoria não encontrada");
    return category;
  }

  async findWithProducts(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: {
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

    if (!category) throw new NotFoundException("Categoria não encontrada");
    return category;
  }

  async create(data: CreateCategoryDto) {
    // Check if category with same name already exists
    const existingCategory = await this.prisma.category.findUnique({
      where: { name: data.name },
    });

    if (existingCategory) {
      throw new BadRequestException("Já existe uma categoria com este nome");
    }

    return this.prisma.category.create({
      data: {
        ...data,
        isActive: true, // Default to active when creating
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
  }

  async update(id: string, data: UpdateCategoryDto) {
    // Check if category exists
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundException("Categoria não encontrada");
    }

    // If updating name, check if new name already exists
    if (data.name && data.name !== existingCategory.name) {
      const nameExists = await this.prisma.category.findUnique({
        where: { name: data.name },
      });

      if (nameExists) {
        throw new BadRequestException("Já existe uma categoria com este nome");
      }
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data,
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
      if (error.code === "P2025") {
        throw new NotFoundException("Categoria não encontrada");
      }
      throw error;
    }
  }

  async delete(id: string) {
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === "P2025") {
        throw new NotFoundException("Categoria não encontrada");
      }
      throw error;
    }
  }

  async deleteSafe(id: string) {
    // Check if category exists
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) throw new NotFoundException("Categoria não encontrada");

    // Check if category has products
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        "Não é possível excluir uma categoria que contém produtos"
      );
    }

    // If no products, proceed with deletion
    return this.prisma.category.delete({ where: { id } });
  }

  // Search Operations
  async findByName(name: string) {
    return this.prisma.category.findFirst({
      where: { name },
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

  async search(params: {
    name?: string;
    description?: string;
    exactMatch?: boolean;
    isActive?: boolean;
  }) {
    const { name, description, exactMatch = false, isActive } = params;

    const where: any = {};

    if (name) {
      where.name = exactMatch ? name : { contains: name, mode: "insensitive" };
    }

    if (description) {
      where.description = exactMatch
        ? description
        : { contains: description, mode: "insensitive" };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.category.findMany({
      where,
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

  // Status Management
  async deactivate(id: string) {
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
      if (error.code === "P2025") {
        throw new NotFoundException("Categoria não encontrada");
      }
      throw error;
    }
  }

  async activate(id: string) {
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
      if (error.code === "P2025") {
        throw new NotFoundException("Categoria não encontrada");
      }
      throw error;
    }
  }

  // Product Relationship Methods
  async countProductsInCategory(id: string) {
    return this.prisma.product.count({
      where: {
        categoryId: id,
        isActive: true, // Only count active products
      },
    });
  }

  async getActiveCategoriesWithProductCount() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            products: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    return categories.map((category) => ({
      ...category,
      productCount: category._count.products,
    }));
  }

  // Hierarchy Support (if needed for your POS)
  async findSubcategories(parentId: string) {
    return this.prisma.category.findMany({
      where: { parentId, isActive: true },
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

  async getCategoryHierarchy() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    // Build hierarchy tree
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
