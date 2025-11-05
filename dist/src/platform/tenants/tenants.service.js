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
exports.TenantsService = void 0;
// src/platform/tenants/tenants.service.ts
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let TenantsService = class TenantsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(dto) {
        return this.prisma.tenant.create({
            data: {
                name: dto.name,
                slug: dto.slug,
            },
            select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
        });
    }
    async findAll(page = 1, limit = 10) {
        const take = Math.min(Number(limit) || 10, 100);
        const skip = (Number(page) - 1) * take;
        const [items, total] = await Promise.all([
            this.prisma.tenant.findMany({
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
            }),
            this.prisma.tenant.count(),
        ]);
        return {
            items,
            page: Number(page),
            limit: take,
            total,
            totalPages: Math.ceil(total / take),
        };
    }
    update(id, dto) {
        return this.prisma.tenant.update({
            where: { id },
            data: {
                name: dto.name,
                slug: dto.slug,
                // isActive: dto.isActive, // se existir no schema
            },
            select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
        });
    }
};
exports.TenantsService = TenantsService;
exports.TenantsService = TenantsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantsService);
