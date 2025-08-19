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
exports.TenantsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const prisma_service_1 = require("../prisma/prisma.service");
const create_tenant_dto_1 = require("./dto/create-tenant.dto");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const pagination_dto_1 = require("../common/dto/pagination.dto");
// (opcional) Swagger
const swagger_1 = require("@nestjs/swagger");
let TenantsController = class TenantsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    ensureSuperAdmin(user) {
        if (user.systemRole !== 'SUPERADMIN') {
            throw new common_1.ForbiddenException('Acesso restrito ao SUPERADMIN.');
        }
    }
    async createTenant(user, dto) {
        this.ensureSuperAdmin(user);
        return this.prisma.tenant.create({
            data: {
                name: dto.name,
                slug: dto.slug?.toLowerCase(),
            },
            select: { id: true, name: true, slug: true, createdAt: true },
        });
    }
    async listTenants(user, { page = 1, limit = 10 }) {
        this.ensureSuperAdmin(user);
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
};
exports.TenantsController = TenantsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Criar tenant (SUPERADMIN)' }),
    (0, swagger_1.ApiResponse)({ status: 201 }),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_tenant_dto_1.CreateTenantDto]),
    __metadata("design:returntype", Promise)
], TenantsController.prototype, "createTenant", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Listar tenants (paginação) (SUPERADMIN)' }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], TenantsController.prototype, "listTenants", null);
exports.TenantsController = TenantsController = __decorate([
    (0, swagger_1.ApiTags)('platform:tenants'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('tenants'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantsController);
