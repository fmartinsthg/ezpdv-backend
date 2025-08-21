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
exports.CategoryController = void 0;
const common_1 = require("@nestjs/common");
const category_service_1 = require("./category.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const create_category_dto_1 = require("./dto/create-category.dto");
const update_category_dto_1 = require("./dto/update-category.dto");
const pagination_category_dto_1 = require("./dto/pagination-category.dto");
const search_category_dto_1 = require("./dto/search-category.dto");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const tenant_util_1 = require("../common/tenant/tenant.util");
let CategoryController = class CategoryController {
    constructor(categoryService) {
        this.categoryService = categoryService;
    }
    // Listagem simples
    async findAll(user, headers) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.findAll(tenantId);
    }
    // Listagem paginada
    async findAllPaginated(user, headers, paginationDto) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.findAllPaginated(tenantId, paginationDto);
    }
    async findOne(user, headers, id) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.findOne(tenantId, id);
    }
    async findWithProducts(user, headers, id) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.findWithProducts(tenantId, id);
    }
    async getActiveCategoriesWithProductCount(user, headers) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.getActiveCategoriesWithProductCount(tenantId);
    }
    async create(user, headers, data) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.create(user, tenantId, data);
    }
    async update(user, headers, id, data) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.update(tenantId, id, data);
    }
    // Status
    async deactivate(user, headers, id) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.deactivate(tenantId, id);
    }
    async activate(user, headers, id) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.activate(tenantId, id);
    }
    // Busca
    async search(user, headers, searchCategoryDto) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.search(tenantId, searchCategoryDto);
    }
    // Exclusão
    async delete(user, headers, id) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.delete(tenantId, id);
    }
    async deleteSafe(user, headers, id) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.deleteSafe(tenantId, id);
    }
    // Hierarquia
    async findSubcategories(user, headers, id) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.findSubcategories(tenantId, id);
    }
    async getCategoryHierarchy(user, headers) {
        const tenantId = (0, tenant_util_1.resolveEffectiveTenantId)(user, headers["x-tenant-id"]);
        return await this.categoryService.getCategoryHierarchy(tenantId);
    }
};
exports.CategoryController = CategoryController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)("paginated"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, pagination_category_dto_1.CategoryPaginationDto]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "findAllPaginated", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(":id/products"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "findWithProducts", null);
__decorate([
    (0, common_1.Get)("active/with-count"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "getActiveCategoriesWithProductCount", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, create_category_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, update_category_dto_1.UpdateCategoryDto]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(":id/deactivate"),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Patch)(":id/activate"),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "activate", null);
__decorate([
    (0, common_1.Get)("search"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, search_category_dto_1.SearchCategoryDto]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "search", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, roles_decorator_1.Roles)("ADMIN"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "delete", null);
__decorate([
    (0, common_1.Delete)(":id/safe"),
    (0, roles_decorator_1.Roles)("ADMIN"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "deleteSafe", null);
__decorate([
    (0, common_1.Get)(":id/subcategories"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "findSubcategories", null);
__decorate([
    (0, common_1.Get)("hierarchy"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "getCategoryHierarchy", null);
exports.CategoryController = CategoryController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)("categories"),
    __metadata("design:paramtypes", [category_service_1.CategoryService])
], CategoryController);
