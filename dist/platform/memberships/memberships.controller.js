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
// src/platform/memberships/memberships.controller.ts
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../../auth/jwt.guard");
const current_user_decorator_1 = require("../../auth/current-user.decorator");
const memberships_service_1 = require("./memberships.service");
const create_membership_dto_1 = require("./dto/create-membership.dto");
const client_1 = require("@prisma/client");
let MembershipsController = class MembershipsController {
    constructor(service) {
        this.service = service;
    }
    resolveTenantScope(user, paramTenantId) {
        if (user.systemRole === 'SUPERADMIN')
            return paramTenantId;
        if (!user.tenantId || user.tenantId !== paramTenantId) {
            throw new common_1.ForbiddenException('Operação não permitida para este tenant.');
        }
        if (user.role !== client_1.TenantRole.ADMIN) {
            throw new common_1.ForbiddenException('Apenas ADMIN do tenant pode gerenciar membros.');
        }
        return paramTenantId;
    }
    list(user, tenantIdParam) {
        const tenantId = this.resolveTenantScope(user, tenantIdParam);
        return this.service.list(tenantId);
    }
    create(user, tenantIdParam, dto) {
        const tenantId = this.resolveTenantScope(user, tenantIdParam);
        return this.service.create(tenantId, dto);
    }
};
exports.MembershipsController = MembershipsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tenantId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MembershipsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tenantId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_membership_dto_1.CreateMembershipDto]),
    __metadata("design:returntype", void 0)
], MembershipsController.prototype, "create", null);
exports.MembershipsController = MembershipsController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('tenants/:tenantId/memberships'),
    __metadata("design:paramtypes", [memberships_service_1.MembershipsService])
], MembershipsController);
