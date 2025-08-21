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
exports.TenantUsersController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../../../auth/jwt.guard");
const current_user_decorator_1 = require("../../../auth/current-user.decorator");
const tenant_users_service_1 = require("./tenant-users.service");
const create_tenant_user_dto_1 = require("./dto/create-tenant-user.dto");
let TenantUsersController = class TenantUsersController {
    constructor(service) {
        this.service = service;
    }
    async create(user, tenantId, dto) {
        // SUPERADMIN pode criar em qualquer tenant
        if (user.systemRole !== 'SUPERADMIN') {
            if (!user.tenantId || user.tenantId !== tenantId) {
                throw new common_1.ForbiddenException('Operação não permitida para este tenant.');
            }
            // somente ADMIN do tenant pode criar usuários
            if (user.role !== 'ADMIN') {
                throw new common_1.ForbiddenException('Apenas ADMIN do tenant pode criar usuários.');
            }
        }
        return this.service.createUserAndMembership(tenantId, dto);
    }
};
exports.TenantUsersController = TenantUsersController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('tenantId', new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_tenant_user_dto_1.CreateTenantUserDto]),
    __metadata("design:returntype", Promise)
], TenantUsersController.prototype, "create", null);
exports.TenantUsersController = TenantUsersController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('tenants/:tenantId/users'),
    __metadata("design:paramtypes", [tenant_users_service_1.TenantUsersService])
], TenantUsersController);
