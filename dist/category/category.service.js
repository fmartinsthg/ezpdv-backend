"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CategoryService = class CategoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
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
    async findAllPaginated(params) {
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
    async findOne(id) {
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
        if (!category)
            throw new common_1.NotFoundException("Categoria não encontrada");
        return category;
    }
    async findWithProducts(id) {
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
        if (!category)
            throw new common_1.NotFoundException("Categoria não encontrada");
        return category;
    }
    async create(data) {
        // Check if category with same name already exists
        const existingCategory = await this.prisma.category.findUnique({
            where: { name: data.name },
        });
        if (existingCategory) {
            throw new common_1.BadRequestException("Já existe uma categoria com este nome");
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
    async update(id, data) {
        // Check if category exists
        const existingCategory = await this.prisma.category.findUnique({
            where: { id },
        });
        if (!existingCategory) {
            throw new common_1.NotFoundException("Categoria não encontrada");
        }
        // If updating name, check if new name already exists
        if (data.name && data.name !== existingCategory.name) {
            const nameExists = await this.prisma.category.findUnique({
                where: { name: data.name },
            });
            if (nameExists) {
                throw new common_1.BadRequestException("Já existe uma categoria com este nome");
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
        }
        catch (error) {
            if (error.code === "P2025") {
                throw new common_1.NotFoundException("Categoria não encontrada");
            }
            throw error;
        }
    }
    async delete(id) {
        try {
            return await this.prisma.category.delete({ where: { id } });
        }
        catch (error) {
            if (error.code === "P2025") {
                throw new common_1.NotFoundException("Categoria não encontrada");
            }
            throw error;
        }
    }
    async deleteSafe(id) {
        // Check if category exists
        const category = await this.prisma.category.findUnique({
            where: { id },
        });
        if (!category)
            throw new common_1.NotFoundException("Categoria não encontrada");
        // Check if category has products
        const productCount = await this.prisma.product.count({
            where: { categoryId: id },
        });
        if (productCount > 0) {
            throw new common_1.BadRequestException("Não é possível excluir uma categoria que contém produtos");
        }
        // If no products, proceed with deletion
        return this.prisma.category.delete({ where: { id } });
    }
    // Search Operations
    async findByName(name) {
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
    async search(params) {
        const { name, description, exactMatch = false, isActive } = params;
        const where = {};
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
    async deactivate(id) {
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
        }
        catch (error) {
            if (error.code === "P2025") {
                throw new common_1.NotFoundException("Categoria não encontrada");
            }
            throw error;
        }
    }
    async activate(id) {
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
        }
        catch (error) {
            if (error.code === "P2025") {
                throw new common_1.NotFoundException("Categoria não encontrada");
            }
            throw error;
        }
    }
    // Product Relationship Methods
    async countProductsInCategory(id) {
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
    async findSubcategories(parentId) {
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
        const buildTree = (parentId = null) => {
            return categories
                .filter((category) => category.parentId === parentId)
                .map((category) => ({
                ...category,
                children: buildTree(category.id),
            }));
        };
        return buildTree();
    }
};
exports.CategoryService = CategoryService;
exports.CategoryService = CategoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoryService);
