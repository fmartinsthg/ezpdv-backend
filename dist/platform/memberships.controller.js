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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const create_membership_dto_1 = require("./dto/create-membership.dto");
const client_1 = require("@prisma/client");
//Swagger
const swagger_1 = require("@nestjs/swagger");
let MembershipsController = class MembershipsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    resolveTargetTenantId(user, paramTenantId) {
        // SUPERADMIN pode operar em qualquer tenant explicitado na rota
        if (user.systemRole === 'SUPERADMIN') {
            return paramTenantId;
        }
        // ADMIN do tenant pode operar só no próprio tenant
        if (!user.tenantId || user.tenantId !== paramTenantId) {
            throw new common_1.ForbiddenException('Operação não permitida para este tenant.');
        }
        if (user.role !== client_1.TenantRole.ADMIN) {
            throw new common_1.ForbiddenException('Apenas ADMIN do tenant pode gerenciar membros.');
        }
        return paramTenantId;
    }
    async listMembers(user, tenantIdParam) {
        const tenantId = this.resolveTargetTenantId(user, tenantIdParam);
        const memberships = await this.prisma.userTenant.findMany({
            where: { tenantId },
            include: {
                user: { select: { id: true, name: true, email: true, active: true, systemRole: true } },
            },
            orderBy: { role: 'asc' },
        });
        return memberships.map((m) => ({
            userId: m.userId,
            tenantId: m.tenantId,
            role: m.role,
            user: m.user,
        }));
    }
    async createMember(user, tenantIdParam, dto) {
        const tenantId = this.resolveTargetTenantId(user, tenantIdParam);
        // valida se tenant existe
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            throw new common_1.ForbiddenException('Tenant inexistente.');
        }
        // impede duplicidade
        const existing = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId: { userId: dto.userId, tenantId } },
        });
        if (existing) {
            // já existe: apenas retorna (ou poderia atualizar o role se quisesse)
            return existing;
        }
        // cria vínculo
        return this.prisma.userTenant.create({
            data: {
                userId: dto.userId,
                tenantId,
                role: dto.role,
            },
        });
    }
};
exports.MembershipsController = MembershipsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Listar membros do tenant' }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tenantId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MembershipsController.prototype, "listMembers", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Criar/associar membro ao tenant' }),
    (0, swagger_1.ApiResponse)({ status: 201 }),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tenantId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_membership_dto_1.CreateMembershipDto]),
    __metadata("design:returntype", Promise)
], MembershipsController.prototype, "createMember", null);
exports.MembershipsController = MembershipsController = __decorate([
    (0, swagger_1.ApiTags)('platform:memberships'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('tenants/:tenantId/memberships'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MembershipsController);
