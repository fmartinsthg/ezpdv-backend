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
exports.WebhooksController = void 0;
// src/webhooks/webhooks.controller.ts
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const tenant_decorator_1 = require("../common/tenant/tenant.decorator");
const idempotency_decorator_1 = require("../common/idempotency/idempotency.decorator");
const webhooks_service_1 = require("./webhooks.service");
const create_endpoint_dto_1 = require("./dto/create-endpoint.dto");
const update_endpoint_dto_1 = require("./dto/update-endpoint.dto");
const replay_dto_1 = require("./dto/replay.dto");
const list_deliveries_dto_1 = require("./dto/list-deliveries.dto");
const presenter_1 = require("./presenter");
let WebhooksController = class WebhooksController {
    constructor(svc) {
        this.svc = svc;
    }
    async createEndpoint(tenantId, dto) {
        const ep = await this.svc.createEndpoint(tenantId, dto);
        return (0, presenter_1.presentEndpoint)(ep);
    }
    async listEndpoints(tenantId) {
        return this.svc.listEndpoints(tenantId);
    }
    async patchEndpoint(tenantId, id, dto, ifMatch) {
        const ep = await this.svc.patchEndpoint(tenantId, id, dto, ifMatch);
        return (0, presenter_1.presentEndpoint)(ep);
    }
    async rotateSecret(tenantId, id, ifMatch) {
        const ep = await this.svc.rotateSecret(tenantId, id, ifMatch);
        return (0, presenter_1.presentEndpoint)(ep);
    }
    async replay(tenantId, dto) {
        return this.svc.replay(tenantId, dto);
    }
    async listDeliveries(tenantId, query) {
        return this.svc.listDeliveries(tenantId, query);
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Criar endpoint" }),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN"),
    (0, idempotency_decorator_1.Idempotent)("webhooks:endpoints:create"),
    (0, common_1.Post)("endpoints"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_endpoint_dto_1.CreateEndpointDto]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "createEndpoint", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Listar endpoints" }),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN"),
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, common_1.Get)("endpoints"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "listEndpoints", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Atualizar endpoint (If-Match)" }),
    (0, swagger_1.ApiHeader)({ name: "If-Match", required: false }),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN"),
    (0, common_1.Patch)("endpoints/:id"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)("if-match")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_endpoint_dto_1.UpdateEndpointDto, String]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "patchEndpoint", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Rotacionar segredo (If-Match)" }),
    (0, swagger_1.ApiHeader)({ name: "If-Match", required: true }),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN"),
    (0, common_1.Post)("endpoints/:id/rotate-secret"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("id", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Headers)("if-match")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "rotateSecret", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Replay por ids ou janela" }),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN"),
    (0, idempotency_decorator_1.Idempotent)("webhooks:replay"),
    (0, common_1.Post)("replay"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, replay_dto_1.ReplayDto]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "replay", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Listar entregas" }),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN"),
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, common_1.Get)("deliveries"),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, list_deliveries_dto_1.ListDeliveriesDto]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "listDeliveries", null);
exports.WebhooksController = WebhooksController = __decorate([
    (0, swagger_1.ApiTags)("webhooks"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("tenants/:tenantId/webhooks"),
    __metadata("design:paramtypes", [webhooks_service_1.WebhooksService])
], WebhooksController);
