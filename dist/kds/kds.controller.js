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
const kds_service_1 = require("./kds.service");
const kds_query_dto_1 = require("./dto/kds-query.dto");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const tenant_context_guard_1 = require("../common/tenant/tenant-context.guard");
let KdsController = class KdsController {
    constructor(service) {
        this.service = service;
    }
    async listTickets(tenantId, q) {
        const station = String(q.station || "").toUpperCase();
        const status = String(q.status ?? client_1.OrderItemStatus.FIRED).toUpperCase();
        return this.service.listTickets(tenantId, station, status, q.since, {
            page: q.page,
            pageSize: q.pageSize,
        });
    }
    async listItems(tenantId, q) {
        const station = String(q.station || "").toUpperCase();
        const status = String(q.status ?? client_1.OrderItemStatus.FIRED).toUpperCase();
        return this.service.listItems(tenantId, station, status, {
            page: q.page,
            pageSize: q.pageSize,
        });
    }
    async completeItem(tenantId, itemId, req) {
        return this.service.completeItem(tenantId, itemId, req.user.userId);
    }
    async bulkComplete(tenantId, body, req) {
        return this.service.bulkComplete(tenantId, body.itemIds, req.user.userId);
    }
    async bumpTicket(tenantId, orderId, ifMatch, req) {
        return this.service.bumpTicket(tenantId, orderId, ifMatch, req.user.userId);
    }
    async recallTicket(tenantId, orderId, req) {
        return this.service.recallTicket(tenantId, orderId, req.user.userId);
    }
};
exports.KdsController = KdsController;
__decorate([
    (0, common_1.Get)("tickets"),
    __param(0, (0, common_1.Param)("tenantId", new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, kds_query_dto_1.KdsListTicketsQueryDto]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "listTickets", null);
__decorate([
    (0, common_1.Get)("items"),
    __param(0, (0, common_1.Param)("tenantId", new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, kds_query_dto_1.KdsListItemsQueryDto]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "listItems", null);
__decorate([
    (0, common_1.Post)("items/:itemId/complete"),
    __param(0, (0, common_1.Param)("tenantId", new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Param)("itemId", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "completeItem", null);
__decorate([
    (0, common_1.Post)("items/bulk-complete"),
    __param(0, (0, common_1.Param)("tenantId", new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, kds_query_dto_1.BulkCompleteDto, Object]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "bulkComplete", null);
__decorate([
    (0, common_1.Post)("tickets/:orderId/bump"),
    __param(0, (0, common_1.Param)("tenantId", new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Param)("orderId", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Headers)("if-match")),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "bumpTicket", null);
__decorate([
    (0, common_1.Post)("tickets/:orderId/recall"),
    __param(0, (0, common_1.Param)("tenantId", new common_1.ParseUUIDPipe())),
    __param(1, (0, common_1.Param)("orderId", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], KdsController.prototype, "recallTicket", null);
exports.KdsController = KdsController = __decorate([
    (0, common_1.Controller)("/tenants/:tenantId/kds"),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, tenant_context_guard_1.TenantContextGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "MODERATOR", "USER"),
    __metadata("design:paramtypes", [kds_service_1.KdsService])
], KdsController);
