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
exports.PaymentIntentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const payment_intents_service_1 = require("./payment-intents.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const tenant_decorator_1 = require("../common/tenant/tenant.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const create_intent_dto_1 = require("./dto/create-intent.dto");
const idempotency_decorator_1 = require("../common/idempotency/idempotency.decorator");
let PaymentIntentsController = class PaymentIntentsController {
    constructor(intents) {
        this.intents = intents;
    }
    async createOrGet(tenantId, orderId, user, dto) {
        const userId = user?.id ?? user?.sub;
        return this.intents.createOrGet(tenantId, orderId, userId, dto);
    }
    async getById(tenantId, intentId) {
        return this.intents.getById(tenantId, intentId);
    }
};
exports.PaymentIntentsController = PaymentIntentsController;
__decorate([
    (0, common_1.Post)('tenants/:tenantId/orders/:orderId/payment-intents'),
    (0, roles_decorator_1.Roles)(client_1.SystemRole.SUPERADMIN, client_1.TenantRole.ADMIN, client_1.TenantRole.MODERATOR, client_1.TenantRole.USER),
    (0, idempotency_decorator_1.Idempotent)('payments:intent:create'),
    (0, swagger_1.ApiOperation)({ summary: 'Cria (ou retorna) um PaymentIntent OPEN para a order CLOSED' }),
    (0, swagger_1.ApiParam)({ name: 'tenantId', example: '...' }),
    (0, swagger_1.ApiParam)({ name: 'orderId', example: '...' }),
    (0, swagger_1.ApiResponse)({ status: 201 }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('orderId', new common_1.ParseUUIDPipe())),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, create_intent_dto_1.CreatePaymentIntentDto]),
    __metadata("design:returntype", Promise)
], PaymentIntentsController.prototype, "createOrGet", null);
__decorate([
    (0, common_1.Get)('tenants/:tenantId/payment-intents/:intentId'),
    (0, roles_decorator_1.Roles)(client_1.SystemRole.SUPERADMIN, client_1.TenantRole.ADMIN, client_1.TenantRole.MODERATOR, client_1.TenantRole.USER),
    (0, swagger_1.ApiOperation)({ summary: 'Consulta um PaymentIntent por ID' }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('intentId', new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PaymentIntentsController.prototype, "getById", null);
exports.PaymentIntentsController = PaymentIntentsController = __decorate([
    (0, swagger_1.ApiTags)('PaymentIntents'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [payment_intents_service_1.PaymentIntentsService])
], PaymentIntentsController);
