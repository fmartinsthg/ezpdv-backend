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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const payments_service_1 = require("./payments.service");
const create_payment_dto_1 = require("./dto/create-payment.dto");
const refund_payment_dto_1 = require("./dto/refund-payment.dto");
const cancel_payment_dto_1 = require("./dto/cancel-payment.dto");
const query_payments_dto_1 = require("./dto/query-payments.dto");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const tenant_decorator_1 = require("../common/tenant/tenant.decorator");
const payments_approval_guard_1 = require("./payments.approval.guard");
const idempotency_decorator_1 = require("../common/idempotency/idempotency.decorator");
// Guards específicos de caixa nos métodos
const require_open_cash_session_guard_1 = require("../cash/guards/require-open-cash-session.guard");
let PaymentsController = class PaymentsController {
    constructor(payments) {
        this.payments = payments;
    }
    async createAndCapture(tenantId, orderId, dto, user, req) {
        const actorId = user?.userId ?? user?.id ?? user?.sub;
        if (!actorId)
            throw new common_1.BadRequestException("Invalid authenticated user (missing id/sub).");
        dto.orderId = orderId;
        const stationId = req.headers["x-station-id"];
        return this.payments.capture(tenantId, dto, actorId, stationId);
    }
    async listByOrder(tenantId, orderId) {
        return this.payments.listByOrder(tenantId, orderId);
    }
    async listByTenant(tenantId, query) {
        return this.payments.listByTenant(tenantId, query);
    }
    async refund(tenantId, paymentId, dto, req) {
        const approvalUserId = req?.approvalUser?.userId ??
            req?.approvalUser?.id ??
            req?.approvalUser?.sub;
        if (!approvalUserId)
            throw new common_1.BadRequestException("Missing approval user id/sub");
        return this.payments.refund(tenantId, paymentId, dto, approvalUserId);
    }
    async cancel(tenantId, paymentId, dto, req) {
        const approvalUserId = req?.approvalUser?.userId ??
            req?.approvalUser?.id ??
            req?.approvalUser?.sub;
        if (!approvalUserId)
            throw new common_1.BadRequestException("Missing approval user id/sub");
        return this.payments.cancel(tenantId, paymentId, dto, approvalUserId);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)("tenants/:tenantId/orders/:orderId/payments"),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN", "MODERATOR", "USER"),
    (0, common_1.HttpCode)(201),
    (0, idempotency_decorator_1.Idempotent)("payments:capture"),
    (0, common_1.UseGuards)(require_open_cash_session_guard_1.RequireOpenCashSessionGuard),
    (0, swagger_1.ApiOperation)({
        summary: "Captura de pagamento (associação automática à CashSession OPEN do dia)",
    }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Key",
        required: true,
        description: "UUID por request",
    }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "Valor fixo: payments:capture",
    }),
    (0, swagger_1.ApiHeader)({
        name: "X-Station-Id",
        required: false,
        description: "Identificador da estação (ex.: bar-01) — opcionalmente usado para UX/relatórios",
        example: "bar-01",
    }),
    (0, swagger_1.ApiParam)({
        name: "tenantId",
        example: "eeb5f3a5-9f0f-4f64-9a63-1d1d91de0e5b",
    }),
    (0, swagger_1.ApiParam)({
        name: "orderId",
        example: "6fbc4c11-5b30-4ab6-a1a9-2b20b847da0b",
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: "Pagamento capturado" }),
    (0, swagger_1.ApiResponse)({ status: 409, description: "Conflito de soma ou idempotência" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("orderId", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_payment_dto_1.CreatePaymentDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "createAndCapture", null);
__decorate([
    (0, common_1.Get)("tenants/:tenantId/orders/:orderId/payments"),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN", "MODERATOR", "USER"),
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, require_open_cash_session_guard_1.AllowWithoutCashSession)(),
    (0, swagger_1.ApiOperation)({ summary: "Lista pagamentos de uma ordem" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("orderId", new common_1.ParseUUIDPipe())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "listByOrder", null);
__decorate([
    (0, common_1.Get)("tenants/:tenantId/payments"),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN", "MODERATOR"),
    (0, idempotency_decorator_1.Idempotent)(idempotency_decorator_1.IDEMPOTENCY_FORBIDDEN),
    (0, require_open_cash_session_guard_1.AllowWithoutCashSession)(),
    (0, swagger_1.ApiOperation)({ summary: "Lista pagamentos do tenant (filtros + paginação)" }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, query_payments_dto_1.QueryPaymentsDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "listByTenant", null);
__decorate([
    (0, common_1.Post)("tenants/:tenantId/payments/:paymentId/refund"),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN", "MODERATOR"),
    (0, common_1.UseGuards)(payments_approval_guard_1.PaymentsApprovalGuard, require_open_cash_session_guard_1.RequireOpenCashSessionGuard),
    (0, idempotency_decorator_1.Idempotent)("payments:refund"),
    (0, swagger_1.ApiOperation)({ summary: "Estorno total/parcial de um pagamento CAPTURED" }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "Valor fixo: payments:refund",
    }),
    (0, swagger_1.ApiHeader)({
        name: "X-Approval-Token",
        required: true,
        description: "JWT válido com role MODERATOR/ADMIN/SUPERADMIN",
    }),
    (0, swagger_1.ApiParam)({
        name: "paymentId",
        example: "b9a7a6d9-2a6d-4d8a-8a71-9e8f3fddf6d0",
    }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("paymentId", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, refund_payment_dto_1.RefundPaymentDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "refund", null);
__decorate([
    (0, common_1.Post)("tenants/:tenantId/payments/:paymentId/cancel"),
    (0, roles_decorator_1.Roles)("SUPERADMIN", "ADMIN", "MODERATOR"),
    (0, common_1.UseGuards)(payments_approval_guard_1.PaymentsApprovalGuard, require_open_cash_session_guard_1.RequireOpenCashSessionGuard),
    (0, idempotency_decorator_1.Idempotent)("payments:cancel"),
    (0, swagger_1.ApiOperation)({ summary: "Cancelamento de um pagamento PENDING" }),
    (0, swagger_1.ApiHeader)({ name: "Idempotency-Key", required: true }),
    (0, swagger_1.ApiHeader)({
        name: "Idempotency-Scope",
        required: true,
        description: "Valor fixo: payments:cancel",
    }),
    (0, swagger_1.ApiHeader)({ name: "X-Approval-Token", required: true }),
    (0, swagger_1.ApiParam)({
        name: "paymentId",
        example: "b9a7a6d9-2a6d-4d8a-8a71-9e8f3fddf6d0",
    }),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)("paymentId", new common_1.ParseUUIDPipe())),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, cancel_payment_dto_1.CancelPaymentDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "cancel", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)("payments"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
