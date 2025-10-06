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
const idempotency_decorator_1 = require("../common/idempotency/idempotency.decorator");
const order_presenter_1 = require("./order.presenter");
let OrdersController = class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    async create(tenantId, user, dto, _idempotencyKey // o interceptor já valida/usa
    ) {
        const order = await this.ordersService.create(tenantId, user, dto);
        return (0, order_presenter_1.presentOrder)(order);
    }
    async findAll(tenantId, user, query) {
        const result = await this.ordersService.findAll(tenantId, user, query);
        return {
            ...result,
            items: result.items.map(order_presenter_1.presentOrder),
        };
    }
    async findOne(tenantId, _user, id) {
        const order = await this.ordersService.findOne(tenantId, id, {
            includePayments: true,
        });
        return (0, order_presenter_1.presentOrder)(order);
    }
    async appendItems(tenantId, user, id, dto, ifMatch) {
        const order = await this.ordersService.appendItems(tenantId, user, id, dto, ifMatch);
        return (0, order_presenter_1.presentOrder)(order);
    }
    async fireItems(tenantId, user, id, dto, ifMatch) {
        const order = await this.ordersService.fireItems(tenantId, user, id, dto, ifMatch);
        return (0, order_presenter_1.presentOrder)(order);
    }
    async voidItem(tenantId, user, id, itemId, dto, approvalToken, ifMatch) {
        if (!approvalToken) {
            throw new common_1.ForbiddenException("Aprovação requerida (X-Approval-Token).");
        }
        const order = await this.ordersService.voidItem(tenantId, user, id, itemId, dto, approvalToken, ifMatch);
        return (0, order_presenter_1.presentOrder)(order);
    }
    async cancel(tenantId, user, id, ifMatch) {
        const order = await this.ordersService.cancel(tenantId, user, id, ifMatch);
        return (0, order_presenter_1.presentOrder)(order);
    }
    async close(tenantId, user, id, dto, ifMatch) {
        const order = await this.ordersService.close(tenantId, user, id, dto, ifMatch);
        return (0, order_presenter_1.presentOrder)(order);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Criar comanda (ORDER OPEN) - Idempotente" }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Key",
        required: true,
        description: "UUID v4 por request",
    }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "Valor fixo: orders:create",
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: "Order criada" }),
    (0, swagger_1.ApiParam)({ name: "tenantId", type: "string", format: "uuid" }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER"),
    (0, idempotency_decorator_1.Idempotent)("orders:create"),
    (0, common_1.Post)(),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)("idempotency-key")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, create_order_dto_1.CreateOrderDto, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Listar comandas do tenant (filtros/paginação)" }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: "tenantId", type: "string", format: "uuid" }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER"),
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN) // evita clientes enviarem headers idem por engano
    ,
    (0, common_1.Get)(),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, orders_query_dto_1.OrdersQueryDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Obter comanda por ID (detalhe)" }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: "tenantId", type: "string", format: "uuid" }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER"),
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, common_1.Get)(":id"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Adicionar itens STAGED na comanda" }),
    (0, swagger_1.ApiHeader)({
        name: "If-Match",
        required: false,
        description: 'Versão atual (ex.: 5, "5" ou W/"5")',
    }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "orders:append-items (ou orders:items:append)",
    }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: "tenantId", type: "string", format: "uuid" }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER"),
    (0, idempotency_decorator_1.Idempotent)(["orders:append-items", "orders:items:append"]),
    (0, common_1.Post)(":id/items"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.Headers)("if-match")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, append_items_dto_1.AppendItemsDto, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "appendItems", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Disparar (FIRE) itens STAGED para produção" }),
    (0, swagger_1.ApiHeader)({ name: "If-Match", required: false }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "Valor fixo: orders:fire",
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Itens marcados como FIRED e estoque debitado",
    }),
    (0, swagger_1.ApiParam)({ name: "tenantId", type: "string", format: "uuid" }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER"),
    (0, idempotency_decorator_1.Idempotent)("orders:fire"),
    (0, common_1.Post)(":id/fire"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.Headers)("if-match")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, fire_dto_1.FireDto, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "fireItems", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "VOID de item FIRED (requer aprovação extra)" }),
    (0, swagger_1.ApiHeader)({ name: "If-Match", required: false }),
    (0, swagger_1.ApiHeader)({
        name: "X-Approval-Token",
        required: true,
        description: 'JWT de MODERATOR/ADMIN/SUPERADMIN (pode ser "Bearer ...")',
    }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "orders:void-item (ou orders:items:void)",
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Item anulado e estoque recreditado",
    }),
    (0, swagger_1.ApiParam)({ name: "tenantId", type: "string", format: "uuid" }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER"),
    (0, idempotency_decorator_1.Idempotent)(["orders:void-item", "orders:items:void"]),
    (0, common_1.Post)(":id/items/:itemId/void"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Param)("itemId", new common_1.ParseUUIDPipe())),
    __param(4, (0, common_1.Body)()),
    __param(5, (0, common_1.Headers)("x-approval-token")),
    __param(6, (0, common_1.Headers)("if-match")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, void_item_dto_1.VoidItemDto, String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "voidItem", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Cancelar comanda (somente sem itens ativos)" }),
    (0, swagger_1.ApiHeader)({ name: "If-Match", required: false }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "Valor fixo: orders:cancel",
    }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: "tenantId", type: "string", format: "uuid" }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR"),
    (0, idempotency_decorator_1.Idempotent)("orders:cancel"),
    (0, common_1.Post)(":id/cancel"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Headers)("if-match")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "cancel", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: "Fechar comanda (handoff para módulo de Pagamentos/Caixa)",
    }),
    (0, swagger_1.ApiHeader)({ name: "If-Match", required: false }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "Valor fixo: orders:close",
    }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    (0, swagger_1.ApiParam)({ name: "tenantId", type: "string", format: "uuid" }),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER") // garçom pode fechar
    ,
    (0, idempotency_decorator_1.Idempotent)("orders:close"),
    (0, common_1.Post)(":id/close"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.Headers)("if-match")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, close_order_dto_1.CloseOrderDto, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "close", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)("orders"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard) // TenantContext guard global já ativo
    ,
    (0, common_1.Controller)("tenants/:tenantId/orders"),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
