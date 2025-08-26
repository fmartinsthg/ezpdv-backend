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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const tenant_decorator_1 = require("../common/tenant/tenant.decorator");
const create_order_dto_1 = require("./dto/create-order.dto");
const orders_query_dto_1 = require("./dto/orders-query.dto");
const append_items_dto_1 = require("./dto/append-items.dto");
const fire_dto_1 = require("./dto/fire.dto");
const void_item_dto_1 = require("./dto/void-item.dto");
const close_order_dto_1 = require("./dto/close-order.dto");
const swagger_1 = require("@nestjs/swagger");
let OrdersController = class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    async create(tenantId, user, dto, idempotencyKey) {
        return this.ordersService.create(tenantId, user, dto, idempotencyKey);
    }
    async findAll(tenantId, user, query) {
        return this.ordersService.findAll(tenantId, user, query);
    }
    async findOne(tenantId, _user, id) {
        return this.ordersService.findOne(tenantId, id);
    }
    async appendItems(tenantId, user, id, dto) {
        return this.ordersService.appendItems(tenantId, user, id, dto);
    }
    async fireItems(tenantId, user, id, dto) {
        return this.ordersService.fireItems(tenantId, user, id, dto);
    }
    async voidItem(tenantId, user, id, itemId, dto, approvalToken) {
        if (!approvalToken) {
            throw new common_1.ForbiddenException('Aprovação requerida (X-Approval-Token).');
        }
        return this.ordersService.voidItem(tenantId, user, id, itemId, dto, approvalToken);
    }
    async cancel(tenantId, user, id) {
        return this.ordersService.cancel(tenantId, user, id);
    }
    async close(tenantId, user, id, dto) {
        return this.ordersService.close(tenantId, user, id, dto);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Criar comanda (ORDER OPEN) - Idempotente' }),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: false, description: 'Chave idempotente por tenant' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Order criada' }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', type: 'string', format: 'uuid' }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MODERATOR', 'USER'),
    (0, common_1.Post)(),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, create_order_dto_1.CreateOrderDto, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Listar comandas do tenant (filtros/paginação)' }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', type: 'string', format: 'uuid' }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MODERATOR', 'USER'),
    (0, common_1.Get)(),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, orders_query_dto_1.OrdersQueryDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Obter comanda por ID (detalhe)' }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', type: 'string', format: 'uuid' }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MODERATOR', 'USER'),
    (0, common_1.Get)(':id'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Adicionar itens STAGED na comanda' }),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', type: 'string', format: 'uuid' }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MODERATOR', 'USER'),
    (0, common_1.Post)(':id/items'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, append_items_dto_1.AppendItemsDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "appendItems", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Disparar (FIRE) itens STAGED para produção' }),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Itens marcados como FIRED e estoque debitado' }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', type: 'string', format: 'uuid' }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MODERATOR', 'USER'),
    (0, common_1.Post)(':id/fire'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, fire_dto_1.FireDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "fireItems", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'VOID de item FIRED (requer aprovação extra)' }),
    (0, swagger_1.ApiHeader)({ name: 'X-Approval-Token', required: true, description: 'JWT de MODERATOR/ADMIN/SUPERADMIN (pode usar \"Bearer ...\")' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Item anulado e estoque recreditado' }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', type: 'string', format: 'uuid' }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MODERATOR', 'USER') // USER pode solicitar, mas precisa approval token
    ,
    (0, common_1.Post)(':id/items/:itemId/void'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Param)('itemId', new common_1.ParseUUIDPipe())),
    __param(4, (0, common_1.Body)()),
    __param(5, (0, common_1.Headers)('x-approval-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, void_item_dto_1.VoidItemDto, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "voidItem", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Cancelar comanda (somente sem itens ativos)' }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', type: 'string', format: 'uuid' }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MODERATOR'),
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "cancel", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Fechar comanda (handoff para módulo de Pagamentos/Caixa)' }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', type: 'string', format: 'uuid' }),
    (0, roles_decorator_1.Roles)('ADMIN', 'MODERATOR', 'USER') // << permite garçom fechar e levar ao caixa
    ,
    (0, common_1.Post)(':id/close'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)('id', new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, close_order_dto_1.CloseOrderDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "close", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)('orders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard) // TenantContextGuard já está global
    ,
    (0, common_1.Controller)('tenants/:tenantId/orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
