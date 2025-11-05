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
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let MembershipsService = class MembershipsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Permite SUPERADMIN em qualquer tenant; ADMIN somente no próprio tenant */
    async assertCanManageTenant(user, tenantId) {
        if (user.systemRole === 'SUPERADMIN')
            return;
        if (!user.tenantId || user.tenantId !== tenantId) {
            throw new common_1.ForbiddenException('Você só pode gerenciar o seu próprio restaurante.');
        }
        const myMembership = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId: { userId: user.userId, tenantId } },
            select: { role: true },
        });
        if (!myMembership || myMembership.role !== client_1.TenantRole.ADMIN) {
            throw new common_1.ForbiddenException('Apenas ADMIN do restaurante pode gerenciar membros.');
        }
    }
    async list(user, tenantId) {
        await this.assertCanManageTenant(user, tenantId);
        const items = await this.prisma.userTenant.findMany({
            where: { tenantId },
            include: {
                user: { select: { id: true, name: true, email: true, active: true, systemRole: true } },
            },
            orderBy: { role: 'asc' },
        });
        // normaliza a resposta
        return items.map((m) => ({
            userId: m.userId,
            tenantId: m.tenantId,
            role: m.role,
            user: m.user,
        }));
    }
    async create(user, tenantId, dto) {
        await this.assertCanManageTenant(user, tenantId);
        // garante existência do tenant e do usuário
        const [tenant, targetUser] = await Promise.all([
            this.prisma.tenant.findUnique({ where: { id: tenantId } }),
            this.prisma.user.findUnique({ where: { id: dto.userId } }),
        ]);
        if (!tenant)
            throw new common_1.NotFoundException('Tenant inexistente.');
        if (!targetUser)
            throw new common_1.NotFoundException('Usuário inexistente.');
        // evita duplicidade
        const exists = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId: { userId: dto.userId, tenantId } },
        });
        if (exists) {
            throw new common_1.BadRequestException('Usuário já vinculado a este tenant.');
        }
        try {
            return await this.prisma.userTenant.create({
                data: { userId: dto.userId, tenantId, role: dto.role },
                select: {
                    userId: true,
                    tenantId: true,
                    role: true,
                    user: { select: { id: true, name: true, email: true } },
                },
            });
        }
        catch (e) {
            if (e.code === 'P2002') {
                throw new common_1.BadRequestException('Usuário já vinculado a este tenant.');
            }
            throw e;
        }
    }
    /** (Opcional) Remover membro — protege o único ADMIN */
    async remove(user, tenantId, targetUserId) {
        await this.assertCanManageTenant(user, tenantId);
        const membership = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId: { userId: targetUserId, tenantId } },
        });
        if (!membership)
            throw new common_1.NotFoundException('Membro não encontrado.');
        if (membership.role === client_1.TenantRole.ADMIN) {
            const adminCount = await this.prisma.userTenant.count({
                where: { tenantId, role: client_1.TenantRole.ADMIN },
            });
            if (adminCount <= 1) {
                throw new common_1.BadRequestException('Não é possível remover o único ADMIN do restaurante.');
            }
        }
        return this.prisma.userTenant.delete({
            where: { userId_tenantId: { userId: targetUserId, tenantId } },
        });
    }
};
exports.MembershipsService = MembershipsService;
exports.MembershipsService = MembershipsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MembershipsService);
