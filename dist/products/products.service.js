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
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProductsService = class ProductsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.product.findMany({
            include: { category: { select: { id: true, name: true } } },
        });
    }
    async findOne(id) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: { category: { select: { id: true, name: true } } },
        });
        if (!product)
            throw new common_1.NotFoundException("Produto não encontrado");
        return product;
    }
    async create(data) {
        // 1) Confirma existência da categoria
        const category = await this.prisma.category.findUnique({
            where: { id: data.categoryId },
        });
        if (!category) {
            throw new common_1.NotFoundException("Categoria não encontrada para o produto");
        }
        try {
            // Converte price e cost para number se vierem como string
            const price = typeof data.price === "string" ? parseFloat(data.price) : data.price;
            const cost = typeof data.cost === "string" ? parseFloat(data.cost) : data.cost;
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
        }
        catch (err) {
            // Postgres: UUID inválido em algum campo
            if (err.code === "22P02") {
                throw new common_1.BadRequestException("IDs devem ser UUIDs válidos.");
            }
            // Prisma: Violação de FK (categoria inexistente)
            if (err.code === "P2003") {
                throw new common_1.NotFoundException("Categoria informada não existe.");
            }
            // Prisma: Unique, etc
            if (err.code === "P2002") {
                throw new common_1.BadRequestException("Dados duplicados para produto.");
            }
            throw err;
        }
    }
    async update(id, data) {
        // Se vier troca de categoria, valida primeiro
        if (data.categoryId) {
            const category = await this.prisma.category.findUnique({
                where: { id: data.categoryId },
            });
            if (!category)
                throw new common_1.NotFoundException("Categoria informada não existe.");
        }
        try {
            const payload = {
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
        }
        catch (err) {
            if (err.code === "P2025")
                throw new common_1.NotFoundException("Produto não encontrado");
            if (err.code === "22P02")
                throw new common_1.BadRequestException("IDs devem ser UUIDs válidos.");
            if (err.code === "P2003")
                throw new common_1.NotFoundException("Categoria informada não existe.");
            throw err;
        }
    }
    async delete(id) {
        try {
            return await this.prisma.product.delete({ where: { id } });
        }
        catch (err) {
            if (err.code === "P2025")
                throw new common_1.NotFoundException("Produto não encontrado");
            if (err.code === "22P02")
                throw new common_1.BadRequestException("ID deve ser um UUID válido.");
            throw err;
        }
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
