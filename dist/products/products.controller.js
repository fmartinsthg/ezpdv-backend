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
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const products_service_1 = require("./products.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const create_product_dto_1 = require("./dto/create-product.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
const products_query_dto_1 = require("./dto/products-query.dto");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const tenant_1 = require("../common/tenant");
let ProductsController = class ProductsController {
    constructor(productsService) {
        this.productsService = productsService;
    }
    async findAll(tenantId, query) {
        return this.productsService.findAll(tenantId, query);
    }
    async findOne(tenantId, id) {
        return this.productsService.findOne(tenantId, id);
    }
    async create(user, tenantId, data) {
        return this.productsService.create(user, tenantId, data);
    }
    async update(user, tenantId, id, data) {
        return this.productsService.update(user, tenantId, id, data);
    }
    async delete(user, tenantId, id) {
        return this.productsService.delete(user, tenantId, id);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Listar produtos (paginado/filtrado)" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Lista de produtos retornada com sucesso.",
    }),
    (0, common_1.Get)(),
    __param(0, (0, tenant_1.TenantId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, products_query_dto_1.ProductsQueryDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Obter produto por ID" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Produto encontrado." }),
    (0, swagger_1.ApiResponse)({ status: 404, description: "Produto não encontrado." }),
    (0, common_1.Get)(":id"),
    __param(0, (0, tenant_1.TenantId)()),
    __param(1, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Criar produto" }),
    (0, swagger_1.ApiResponse)({ status: 201, description: "Produto criado." }),
    (0, swagger_1.ApiResponse)({ status: 404, description: "Categoria informada não existe." }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, tenant_1.TenantId)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Atualizar produto" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Produto atualizado." }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: "Produto ou categoria não encontrados.",
    }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, common_1.Patch)(":id"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, tenant_1.TenantId)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Excluir produto" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Produto excluído." }),
    (0, swagger_1.ApiResponse)({ status: 404, description: "Produto não encontrado." }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, common_1.Delete)(":id"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, tenant_1.TenantId)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "delete", null);
exports.ProductsController = ProductsController = __decorate([
    (0, swagger_1.ApiTags)("products"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiHeader)({
        name: "X-Tenant-Id",
        description: "Obrigatório para SUPERADMIN operar sobre um tenant específico. Ignorado para ADMIN/MODERATOR/USER.",
        required: false,
    }),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)("products"),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
