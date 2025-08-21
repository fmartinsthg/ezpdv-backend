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
    /**
     * Retorna categorias ativas do tenant, com contagem de produtos ativos.
     */
    async getActiveCategoriesWithProductCount(tenantId) {
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
        const results = await Promise.all(categories.map(async (category) => {
            const productCount = await this.prisma.product.count({
                where: {
                    categoryId: category.id,
                    tenantId,
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
    async findAll(tenantId) {
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
    async findAllPaginated(tenantId, params) {
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
    async findOne(tenantId, id) {
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
        if (!category)
            throw new common_1.NotFoundException('Categoria não encontrada');
        return category;
    }
    async findWithProducts(tenantId, id) {
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
        if (!category)
            throw new common_1.NotFoundException('Categoria não encontrada');
        return category;
    }
    /* =========================
     *        CRUD
     * ========================= */
    async create(user, tenantId, data) {
        // Unicidade por (tenantId, name)
        const exists = await this.prisma.category.findUnique({
            where: { tenantId_name: { tenantId, name: data.name } },
            select: { id: true },
        });
        if (exists) {
            throw new common_1.BadRequestException('Já existe uma categoria com este nome neste restaurante');
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
        }
        catch (error) {
            if (error.code === 'P2002' &&
                error.meta?.target?.includes('tenantId_name')) {
                throw new common_1.ConflictException('Já existe uma categoria com este nome neste restaurante.');
            }
            if (error.code === 'P2003') {
                // FK inválida (ex.: parentId não existe no tenant)
                throw new common_1.BadRequestException('Categoria pai inválida.');
            }
            if (error.code === '22P02') {
                // UUID inválido
                throw new common_1.BadRequestException('IDs devem ser UUIDs válidos.');
            }
            throw error;
        }
    }
    async update(tenantId, id, data) {
        // Garante existência e escopo
        const existing = await this.prisma.category.findFirst({
            where: { id, tenantId },
            select: { id: true, name: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Categoria não encontrada');
        // Se trocar o nome, valida unicidade por tenant
        if (data.name && data.name !== existing.name) {
            const nameExists = await this.prisma.category.findUnique({
                where: {
                    tenantId_name: { tenantId, name: data.name },
                },
                select: { id: true },
            });
            if (nameExists) {
                throw new common_1.BadRequestException('Já existe uma categoria com este nome neste restaurante');
            }
        }
        // parentId: conectar, desconectar (null), ou manter (undefined)
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
            if (error.code === 'P2002' &&
                error.meta?.target?.includes('tenantId_name')) {
                throw new common_1.ConflictException('Já existe uma categoria com este nome neste restaurante.');
            }
            if (error.code === 'P2025') {
                throw new common_1.NotFoundException('Categoria não encontrada');
            }
            if (error.code === '22P02') {
                throw new common_1.BadRequestException('IDs devem ser UUIDs válidos.');
            }
            throw error;
        }
    }
    async delete(tenantId, id) {
        // valida escopo
        await this.findOne(tenantId, id);
        try {
            return await this.prisma.category.delete({ where: { id } });
        }
        catch (error) {
            if (error.code === 'P2025') {
                throw new common_1.NotFoundException('Categoria não encontrada');
            }
            throw error;
        }
    }
    async deleteSafe(tenantId, id) {
        // valida escopo
        await this.findOne(tenantId, id);
        // Checa se tem produtos no mesmo tenant
        const productCount = await this.prisma.product.count({
            where: { categoryId: id, tenantId, isActive: true },
        });
        if (productCount > 0) {
            throw new common_1.BadRequestException('Não é possível excluir uma categoria que contém produtos');
        }
        return this.prisma.category.delete({ where: { id } });
    }
    /* =========================
     *        BUSCAS
     * ========================= */
    async findByName(tenantId, name) {
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
    async search(tenantId, params) {
        const { name, description, exactMatch = false, isActive } = params;
        const where = { tenantId };
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
     *        STATUS
     * ========================= */
    async deactivate(tenantId, id) {
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
        }
        catch (error) {
            if (error.code === 'P2025') {
                throw new common_1.NotFoundException('Categoria não encontrada');
            }
            throw error;
        }
    }
    async activate(tenantId, id) {
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
        }
        catch (error) {
            if (error.code === 'P2025') {
                throw new common_1.NotFoundException('Categoria não encontrada');
            }
            throw error;
        }
    }
    /* =========================
     *       HIERARQUIA
     * ========================= */
    async findSubcategories(tenantId, parentId) {
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
    async getCategoryHierarchy(tenantId) {
        const categories = await this.prisma.category.findMany({
            where: { tenantId, isActive: true },
            orderBy: { name: 'asc' },
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
