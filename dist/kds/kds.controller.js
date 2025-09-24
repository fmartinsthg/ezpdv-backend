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
exports.KdsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const rxjs_1 = require("rxjs");
const kds_service_1 = require("./kds.service");
const kds_query_dto_1 = require("./dto/kds-query.dto");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const tenant_context_guard_1 = require("../common/tenant/tenant-context.guard");
const tenant_decorator_1 = require("../common/tenant/tenant.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const kds_bus_1 = require("./kds.bus");
let KdsController = class KdsController {
    constructor(service, bus) {
        this.service = service;
        this.bus = bus;
    }
    async listTickets(tenantId, q) {
        const station = q.station;
        const status = (q.status ?? client_1.OrderItemStatus.FIRED);
        return this.service.listTickets(tenantId, station, status, q.since, {
            page: q.page,
            pageSize: q.pageSize,
        });
    }
    async listItems(tenantId, q) {
        const station = q.station;
        const status = (q.status ?? client_1.OrderItemStatus.FIRED);
        return this.service.listItems(tenantId, station, status, q.since, {
            page: q.page,
            pageSize: q.pageSize,
        });
    }
    async completeItem(tenantId, itemId, user) {
        const actorId = user?.userId ?? user?.sub ?? user?.id;
        return this.service.completeItem(tenantId, itemId, actorId);
    }
    async bulkComplete(tenantId, body, user) {
        const actorId = user?.userId ?? user?.sub ?? user?.id;
        return this.service.bulkComplete(tenantId, body.itemIds, actorId);
    }
    async bumpTicket(tenantId, orderId, ifMatch, user) {
        const actorId = user?.userId ?? user?.sub ?? user?.id;
        return this.service.bumpTicket(tenantId, orderId, ifMatch, actorId);
    }
    async recallTicket(tenantId, orderId, user) {
        const actorId = user?.userId ?? user?.sub ?? user?.id;
        return this.service.recallTicket(tenantId, orderId, actorId);
    }
    stream(tenantId, station) {
        const st = station
            ? String(station).toUpperCase()
            : undefined;
        return this.bus.stream(tenantId, st);
    }
};
exports.KdsController = KdsController;
__decorate([
    (0, common_1.Get)("tickets"),
    (0, swagger_1.ApiOperation)({ summary: "Lista tickets do KDS (agrupado por comanda)" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, kds_query_dto_1.KdsListTicketsQueryDto]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "listTickets", null);
__decorate([
    (0, common_1.Get)("items"),
    (0, swagger_1.ApiOperation)({ summary: "Lista itens do KDS (flat)" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, kds_query_dto_1.KdsListItemsQueryDto]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "listItems", null);
__decorate([
    (0, common_1.Post)("items/:itemId/complete"),
    (0, swagger_1.ApiOperation)({ summary: "Concluir um item (FIRED → CLOSED)" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("itemId", new common_1.ParseUUIDPipe())),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "completeItem", null);
__decorate([
    (0, common_1.Post)("items/bulk-complete"),
    (0, swagger_1.ApiOperation)({ summary: "Concluir vários itens" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, kds_query_dto_1.BulkCompleteDto, Object]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "bulkComplete", null);
__decorate([
    (0, common_1.Post)("tickets/:orderId/bump"),
    (0, swagger_1.ApiOperation)({ summary: "Bump do ticket (fecha todos FIRED da comanda)" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("orderId", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Headers)("if-match")),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "bumpTicket", null);
__decorate([
    (0, common_1.Post)("tickets/:orderId/recall"),
    (0, swagger_1.ApiOperation)({ summary: "Recall do ticket (CLOSED → FIRED)" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("orderId", new common_1.ParseUUIDPipe())),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "recallTicket", null);
__decorate([
    (0, common_1.Sse)("stream"),
    (0, swagger_1.ApiOperation)({ summary: "SSE: push de eventos do KDS em tempo real" }),
    (0, swagger_1.ApiProduces)("text/event-stream")
    // + Anti-buffer/keep-alive (importante atrás de proxies e com compression):
    ,
    (0, common_1.Header)("Cache-Control", "no-cache"),
    (0, common_1.Header)("Connection", "keep-alive"),
    (0, common_1.Header)("X-Accel-Buffering", "no"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Query)("station")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", rxjs_1.Observable)
], KdsController.prototype, "stream", null);
exports.KdsController = KdsController = __decorate([
    (0, swagger_1.ApiTags)("KDS"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("/tenants/:tenantId/kds"),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, tenant_context_guard_1.TenantContextGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER"),
    __metadata("design:paramtypes", [kds_service_1.KdsService,
        kds_bus_1.KdsBus])
], KdsController);
