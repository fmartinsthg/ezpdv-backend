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
// src/category/category.service.ts
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CategoryService = class CategoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Returns all active categories for the tenant, each with the count of active products in that category.
     */
    async getActiveCategoriesWithProductCount(user) {
        // Get all active categories for the tenant
        const categories = await this.prisma.category.findMany({
            where: { tenantId: user.tenantId, isActive: true },
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        // For each category, count active products in that category for the tenant
        const results = await Promise.all(categories.map(async (category) => {
            const productCount = await this.prisma.product.count({
                where: {
                    categoryId: category.id,
                    tenantId: user.tenantId,
                    isActive: true,
                },
            });
            return { ...category, productCount };
        }));
        return results;
    }
    /* =========================
     *        LISTAGEM
     * ========================= */
    async findAll(user) {
        return this.prisma.category.findMany({
            where: { tenantId: user.tenantId },
            orderBy: { name: "asc" },
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
    async findAllPaginated(user, params) {
        const { page = 1, limit = 10, sortBy = "name", sortOrder = "asc" } = params;
        const skip = (page - 1) * limit;
        const [categories, total] = await Promise.all([
            this.prisma.category.findMany({
                where: { tenantId: user.tenantId },
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
            this.prisma.category.count({
                where: { tenantId: user.tenantId },
            }),
        ]);
        return {
            categories,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async findOne(user, id) {
        const category = await this.prisma.category.findFirst({
            where: { id, tenantId: user.tenantId },
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
    async findWithProducts(user, id) {
        const category = await this.prisma.category.findFirst({
            where: { id, tenantId: user.tenantId },
            include: {
                products: {
                    where: { tenantId: user.tenantId },
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
    /* =========================
     *        CRUD
     * ========================= */
    async create(user, data) {
        // Unicidade por tenant (tenantId_name)
        const exists = await this.prisma.category.findUnique({
            where: { tenantId_name: { tenantId: user.tenantId, name: data.name } },
            select: { id: true },
        });
        if (exists) {
            throw new common_1.BadRequestException("Já existe uma categoria com este nome neste restaurante");
        }
        try {
            return await this.prisma.category.create({
                data: {
                    name: data.name,
                    description: data.description,
                    isActive: true,
                    tenant: { connect: { id: user.tenantId } },
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
        }
        catch (error) {
            if (error.code === "P2002" &&
                error.meta?.target?.includes("tenantId_name")) {
                throw new common_1.ConflictException("Já existe uma categoria com este nome neste restaurante.");
            }
            if (error.code === "P2003") {
                // FK inválida (ex.: parentId não existe no tenant)
                throw new common_1.BadRequestException("Categoria pai inválida.");
            }
            if (error.code === "22P02") {
                // UUID inválido
                throw new common_1.BadRequestException("IDs devem ser UUIDs válidos.");
            }
            throw error;
        }
    }
    async update(user, id, data) {
        // Garante existência e escopo
        const existing = await this.prisma.category.findFirst({
            where: { id, tenantId: user.tenantId },
            select: { id: true, name: true },
        });
        if (!existing)
            throw new common_1.NotFoundException("Categoria não encontrada");
        // Se trocar o nome, valida unicidade por tenant
        if (data.name && data.name !== existing.name) {
            const nameExists = await this.prisma.category.findUnique({
                where: {
                    tenantId_name: { tenantId: user.tenantId, name: data.name },
                },
                select: { id: true },
            });
            if (nameExists) {
                throw new common_1.BadRequestException("Já existe uma categoria com este nome neste restaurante");
            }
        }
        // parentId: permitir conectar, desconectar (null), ou manter (undefined)
        const parentData = data.parentId === undefined
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
        }
        catch (error) {
            if (error.code === "P2002" &&
                error.meta?.target?.includes("tenantId_name")) {
                throw new common_1.ConflictException("Já existe uma categoria com este nome neste restaurante.");
            }
            if (error.code === "P2025") {
                throw new common_1.NotFoundException("Categoria não encontrada");
            }
            if (error.code === "22P02") {
                throw new common_1.BadRequestException("IDs devem ser UUIDs válidos.");
            }
            throw error;
        }
    }
    async delete(user, id) {
        // valida escopo
        await this.findOne(user, id);
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
    async deleteSafe(user, id) {
        // valida escopo
        await this.findOne(user, id);
        // Checa se tem produtos no mesmo tenant
        const productCount = await this.prisma.product.count({
            where: { categoryId: id, tenantId: user.tenantId, isActive: true },
        });
        if (productCount > 0) {
            throw new common_1.BadRequestException("Não é possível excluir uma categoria que contém produtos");
        }
        return this.prisma.category.delete({ where: { id } });
    }
    /* =========================
     *        BUSCAS
     * ========================= */
    async findByName(user, name) {
        // Busca exata por chave composta
        return this.prisma.category.findUnique({
            where: { tenantId_name: { tenantId: user.tenantId, name } },
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
    async search(user, params) {
        const { name, description, exactMatch = false, isActive } = params;
        const where = { tenantId: user.tenantId };
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
            orderBy: { name: "asc" },
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
     *        STATUS
     * ========================= */
    async deactivate(user, id) {
        await this.findOne(user, id);
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
    async activate(user, id) {
        await this.findOne(user, id);
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
    /* =========================
     *       HIERARQUIA
     * ========================= */
    async findSubcategories(user, parentId) {
        return this.prisma.category.findMany({
            where: { tenantId: user.tenantId, parentId, isActive: true },
            orderBy: { name: "asc" },
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
    async getCategoryHierarchy(user) {
        const categories = await this.prisma.category.findMany({
            where: { tenantId: user.tenantId, isActive: true },
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
