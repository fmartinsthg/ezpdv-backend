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
exports.MembershipsService = void 0;
// src/platform/memberships/memberships.service.ts
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let MembershipsService = class MembershipsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(tenantId) {
        const items = await this.prisma.userTenant.findMany({
            where: { tenantId },
            include: { user: { select: { id: true, name: true, email: true, active: true, systemRole: true } } },
            orderBy: { role: 'asc' },
        });
        return items.map(m => ({ ...m, user: m.user }));
    }
    async create(tenantId, dto) {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant)
            throw new common_1.NotFoundException('Tenant inexistente.');
        const membership = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId: { userId: dto.userId, tenantId } },
        });
        if (membership) {
            throw new common_1.BadRequestException('Usuário já vinculado a este tenant.');
        }
        return this.prisma.userTenant.create({
            data: { userId: dto.userId, tenantId, role: dto.role },
        });
    }
};
exports.MembershipsService = MembershipsService;
exports.MembershipsService = MembershipsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MembershipsService);
