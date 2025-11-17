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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsFacadeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const tenant_decorator_1 = require("../common/tenant/tenant.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const idempotency_decorator_1 = require("../common/idempotency/idempotency.decorator");
const create_payment_facade_dto_1 = require("./create-payment-facade.dto");
const refund_payment_dto_1 = require("../payments/dto/refund-payment.dto");
const payments_facade_service_1 = require("./payments-facade.service");
let PaymentsFacadeController = class PaymentsFacadeController {
    constructor(facade) {
        this.facade = facade;
    }
    async capture(tenantId, orderId, user, body) {
        const userId = user?.id ?? user?.sub;
        return this.facade.capture(tenantId, orderId, userId, body);
    }
    async refund(tenantId, orderId, paymentId, user, dto) {
        const userId = user?.id ?? user?.sub;
        return this.facade.refund(tenantId, orderId, paymentId, userId, dto);
    }
    async list(tenantId, orderId) {
        return this.facade.listByOrder(tenantId, orderId);
    }
    async listTx(tenantId, orderId, paymentId) {
        return this.facade.listTransactions(tenantId, orderId, paymentId);
    }
};
exports.PaymentsFacadeController = PaymentsFacadeController;
__decorate([
    (0, common_1.Post)("tenants/:tenantId/orders/:orderId/payments"),
    (0, roles_decorator_1.Roles)(client_1.SystemRole.SUPERADMIN, client_1.TenantRole.ADMIN, client_1.TenantRole.MODERATOR, client_1.TenantRole.USER),
    (0, idempotency_decorator_1.Idempotent)("payments:capture"),
    (0, swagger_1.ApiOperation)({
        summary: "Captura pagamento e retorna envelope (order + intent + summary + payment)",
    }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("orderId", common_1.ParseUUIDPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, typeof (_a = typeof create_payment_facade_dto_1.CreatePaymentFromFacadeDto !== "undefined" && create_payment_facade_dto_1.CreatePaymentFromFacadeDto) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], PaymentsFacadeController.prototype, "capture", null);
__decorate([
    (0, common_1.Post)("tenants/:tenantId/orders/:orderId/payments/:paymentId/refunds"),
    (0, roles_decorator_1.Roles)(client_1.SystemRole.SUPERADMIN, client_1.TenantRole.ADMIN, client_1.TenantRole.MODERATOR),
    (0, idempotency_decorator_1.Idempotent)("payments:refund"),
    (0, swagger_1.ApiOperation)({ summary: "Cria refund e retorna envelope reconciliado" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("orderId", common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)("paymentId", common_1.ParseUUIDPipe)),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, refund_payment_dto_1.RefundPaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentsFacadeController.prototype, "refund", null);
__decorate([
    (0, common_1.Get)("tenants/:tenantId/orders/:orderId/payments"),
    (0, roles_decorator_1.Roles)(client_1.SystemRole.SUPERADMIN, client_1.TenantRole.ADMIN, client_1.TenantRole.MODERATOR, client_1.TenantRole.USER),
    (0, swagger_1.ApiOperation)({ summary: "Lista payments por order + envelope reconciliado" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("orderId", common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PaymentsFacadeController.prototype, "list", null);
__decorate([
    (0, common_1.Get)("tenants/:tenantId/orders/:orderId/payments/:paymentId/transactions"),
    (0, roles_decorator_1.Roles)(client_1.SystemRole.SUPERADMIN, client_1.TenantRole.ADMIN, client_1.TenantRole.MODERATOR, client_1.TenantRole.USER),
    (0, swagger_1.ApiOperation)({
        summary: "Lista transações (CAPTURE/REFUND/VOID) de um payment",
    }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("orderId", common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Param)("paymentId", common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], PaymentsFacadeController.prototype, "listTx", null);
exports.PaymentsFacadeController = PaymentsFacadeController = __decorate([
    (0, swagger_1.ApiTags)("Payments (facade)"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [payments_facade_service_1.PaymentsFacadeService])
], PaymentsFacadeController);
