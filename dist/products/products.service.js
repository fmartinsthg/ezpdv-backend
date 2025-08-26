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
exports.ProductsService = void 0;
// src/products/products.service.ts
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let ProductsService = class ProductsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * SUPERADMIN é superuser (pode gerenciar tudo)
     * ADMIN / MODERATOR também podem gerenciar.
     */
    canManage(user) {
        const sys = user?.systemRole ? String(user.systemRole).toUpperCase() : "";
        if (sys === "SUPERADMIN")
            return true;
        const r = user?.role ? String(user.role).toUpperCase() : "";
        return r === "ADMIN" || r === "MODERATOR";
    }
    async findAll(tenantId, query) {
        const { q, categoryId, isActive, sortBy = "name", sortOrder = "asc", page = 1, limit = 10, } = query;
        const take = Math.min(Number(limit) || 10, 100);
        const skip = (Number(page) - 1) * take;
        const where = { tenantId };
        // busca textual
        if (q && q.trim().length > 0) {
            where.OR = [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q, mode: "insensitive" } },
            ];
        }
        // filtro por categoria
        if (categoryId) {
            where.categoryId = categoryId;
        }
        // filtro por ativo
        if (isActive !== undefined) {
            if (typeof isActive === "boolean") {
                where.isActive = isActive;
            }
            else if (typeof isActive === "string") {
                where.isActive = isActive.toLowerCase() === "true";
            }
        }
        // ordenação
        const orderBy = {
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
    async findOne(tenantId, id) {
        const product = await this.prisma.product.findFirst({
            where: { id, tenantId },
            include: { category: { select: { id: true, name: true } } },
        });
        if (!product)
            throw new common_1.NotFoundException("Produto não encontrado");
        return product;
    }
    async create(user, tenantId, data) {
        if (!this.canManage(user)) {
            throw new common_1.ForbiddenException("Sem permissão para criar produtos.");
        }
        // valida categoria dentro do tenant (se enviada)
        if (data.categoryId) {
            const category = await this.prisma.category.findFirst({
                where: { id: data.categoryId, tenantId },
                select: { id: true },
            });
            if (!category) {
                throw new common_1.NotFoundException("Categoria não encontrada para este restaurante.");
            }
        }
        try {
            return await this.prisma.product.create({
                data: {
                    tenantId, // obrigatório no multi-tenant
                    name: data.name,
                    description: data.description,
                    price: new client_1.Prisma.Decimal(typeof data.price === "string" ? data.price : String(data.price)),
                    // `cost` é opcional em alguns contextos — ajuste conforme seu DTO
                    cost: data.cost !== undefined
                        ? new client_1.Prisma.Decimal(typeof data.cost === "string" ? data.cost : String(data.cost))
                        : new client_1.Prisma.Decimal("0"),
                    stock: typeof data.stock === "string" ? Number(data.stock) : data.stock,
                    categoryId: data.categoryId,
                    isActive: true,
                },
                include: { category: { select: { id: true, name: true } } },
            });
        }
        catch (err) {
            if (err.code === "22P02") {
                throw new common_1.BadRequestException("IDs devem ser UUIDs válidos.");
            }
            if (err.code === "P2003") {
                throw new common_1.NotFoundException("Categoria informada não existe.");
            }
            if (err.code === "P2002") {
                // unique (tenantId, name) ou (tenantId, barcode)
                throw new common_1.BadRequestException("Dados duplicados para este restaurante.");
            }
            throw err;
        }
    }
    async update(user, tenantId, id, data) {
        if (!this.canManage(user)) {
            throw new common_1.ForbiddenException("Sem permissão para atualizar produtos.");
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
                throw new common_1.NotFoundException("Categoria informada não existe neste restaurante.");
            }
        }
        try {
            const payload = {
                name: data.name,
                description: data.description,
                stock: data.stock !== undefined
                    ? typeof data.stock === "string"
                        ? Number(data.stock)
                        : data.stock
                    : undefined,
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            };
            if (data.categoryId !== undefined) {
                payload.category = data.categoryId
                    ? { connect: { id: data.categoryId } }
                    : { disconnect: true };
            }
            if (data.price !== undefined) {
                payload.price = new client_1.Prisma.Decimal(typeof data.price === "string" ? data.price : String(data.price));
            }
            if (data.cost !== undefined) {
                payload.cost = new client_1.Prisma.Decimal(typeof data.cost === "string" ? data.cost : String(data.cost));
            }
            return await this.prisma.product.update({
                where: { id },
                data: payload,
                include: { category: { select: { id: true, name: true } } },
            });
        }
        catch (err) {
            if (err.code === "P2025") {
                throw new common_1.NotFoundException("Produto não encontrado");
            }
            if (err.code === "22P02") {
                throw new common_1.BadRequestException("IDs devem ser UUIDs válidos.");
            }
            if (err.code === "P2003") {
                throw new common_1.NotFoundException("Categoria informada não existe.");
            }
            if (err.code === "P2002") {
                throw new common_1.BadRequestException("Dados duplicados para este restaurante.");
            }
            throw err;
        }
    }
    async delete(user, tenantId, id) {
        if (!this.canManage(user)) {
            throw new common_1.ForbiddenException("Sem permissão para remover produtos.");
        }
        // garante escopo (existe no tenant)
        await this.findOne(tenantId, id);
        try {
            return await this.prisma.product.delete({ where: { id } });
        }
        catch (err) {
            if (err.code === "P2025") {
                throw new common_1.NotFoundException("Produto não encontrado");
            }
            if (err.code === "22P02") {
                throw new common_1.BadRequestException("ID deve ser um UUID válido.");
            }
            throw err;
        }
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
