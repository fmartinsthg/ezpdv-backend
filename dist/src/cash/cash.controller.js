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
exports.CashController = void 0;
const common_1 = require("@nestjs/common");
const cash_service_1 = require("./cash.service");
const open_session_dto_1 = require("./dto/open-session.dto");
const movement_dto_1 = require("./dto/movement.dto");
const count_dto_1 = require("./dto/count.dto");
const close_session_dto_1 = require("./dto/close-session.dto");
const reopen_session_dto_1 = require("./dto/reopen-session.dto");
const reassign_payment_dto_1 = require("./dto/reassign-payment.dto");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const tenant_context_guard_1 = require("../common/tenant/tenant-context.guard");
// ⬇️ novo
const require_open_cash_session_guard_1 = require("./guards/require-open-cash-session.guard");
let CashController = class CashController {
    constructor(service) {
        this.service = service;
    }
    list(tenantId, q) {
        return this.service.listSessions(tenantId, q);
    }
    getOpen(tenantId, stationId, req) {
        const sid = stationId ?? req.headers["x-station-id"];
        return this.service.getOpenSession(tenantId, sid);
    }
    detail(tenantId, sessionId) {
        return this.service.getSessionDetail(tenantId, sessionId);
    }
    open(tenantId, dto, req) {
        return this.service.openSession({
            tenantId,
            stationId: dto.stationId ?? req.headers["x-station-id"],
            openingFloat: dto.openingFloat,
            notes: dto.notes,
            userId: req.user.sub,
            idemScope: req.headers["idempotency-scope"],
            idemKey: req.headers["idempotency-key"],
        });
    }
    movement(tenantId, sessionId, dto, req) {
        return this.service.createMovement({
            tenantId,
            sessionId,
            type: dto.type,
            method: dto.method,
            amount: dto.amount,
            reason: dto.reason,
            userId: req.user.sub,
            idemScope: req.headers["idempotency-scope"],
            idemKey: req.headers["idempotency-key"],
        });
    }
    count(tenantId, sessionId, dto, req) {
        return this.service.createCount({
            tenantId,
            sessionId,
            kind: dto.kind,
            denominations: dto.denominations,
            total: dto.total,
            userId: req.user.sub,
            idemScope: req.headers["idempotency-scope"],
            idemKey: req.headers["idempotency-key"],
        });
    }
    reassign(tenantId, sessionId, dto, req) {
        return this.service.reassignPayment({
            tenantId,
            sessionId,
            paymentId: dto.paymentId,
            userId: req.user.sub,
            idemScope: req.headers["idempotency-scope"],
            idemKey: req.headers["idempotency-key"],
        });
    }
    close(tenantId, sessionId, dto, req) {
        return this.service.closeSession({
            tenantId,
            sessionId,
            note: dto.note,
            userId: req.user.sub,
            idemScope: req.headers["idempotency-scope"],
            idemKey: req.headers["idempotency-key"],
        });
    }
    reopen(tenantId, sessionId, dto, req) {
        return this.service.reopenSession({
            tenantId,
            sessionId,
            reason: dto.reason,
            userId: req.user.sub,
            idemScope: req.headers["idempotency-scope"],
            idemKey: req.headers["idempotency-key"],
        });
    }
    reportDaily(tenantId, date) {
        return this.service.reportDaily(tenantId, date);
    }
    export(tenantId, q) {
        return this.service.exportSessions(tenantId, q);
    }
};
exports.CashController = CashController;
__decorate([
    (0, require_open_cash_session_guard_1.AllowWithoutCashSession)(),
    (0, common_1.Get)("sessions"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "list", null);
__decorate([
    (0, require_open_cash_session_guard_1.AllowWithoutCashSession)(),
    (0, common_1.Get)("sessions/open"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Query)("stationId")),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "getOpen", null);
__decorate([
    (0, require_open_cash_session_guard_1.AllowWithoutCashSession)(),
    (0, common_1.Get)("sessions/:sessionId"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("sessionId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "detail", null);
__decorate([
    (0, require_open_cash_session_guard_1.AllowWithoutCashSession)(),
    (0, common_1.Post)("sessions/open"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, open_session_dto_1.OpenSessionDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "open", null);
__decorate([
    (0, common_1.UseGuards)(require_open_cash_session_guard_1.RequireOpenCashSessionGuard),
    (0, common_1.Post)("sessions/:sessionId/movements"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("sessionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, movement_dto_1.CreateMovementDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "movement", null);
__decorate([
    (0, common_1.UseGuards)(require_open_cash_session_guard_1.RequireOpenCashSessionGuard),
    (0, common_1.Post)("sessions/:sessionId/counts"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("sessionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, count_dto_1.CreateCountDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "count", null);
__decorate([
    (0, common_1.UseGuards)(require_open_cash_session_guard_1.RequireOpenCashSessionGuard),
    (0, common_1.Post)("sessions/:sessionId/reassign-payment"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("sessionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, reassign_payment_dto_1.ReassignPaymentDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "reassign", null);
__decorate([
    (0, common_1.UseGuards)(require_open_cash_session_guard_1.RequireOpenCashSessionGuard),
    (0, common_1.Post)("sessions/:sessionId/close"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("sessionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, close_session_dto_1.CloseSessionDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "close", null);
__decorate([
    (0, common_1.UseGuards)(require_open_cash_session_guard_1.RequireOpenCashSessionGuard),
    (0, common_1.Post)("sessions/:sessionId/reopen"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Param)("sessionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, reopen_session_dto_1.ReopenSessionDto, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "reopen", null);
__decorate([
    (0, require_open_cash_session_guard_1.AllowWithoutCashSession)(),
    (0, common_1.Get)("reports/daily"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Query)("date")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "reportDaily", null);
__decorate([
    (0, require_open_cash_session_guard_1.AllowWithoutCashSession)(),
    (0, common_1.Get)("reports/sessions-export"),
    __param(0, (0, common_1.Param)("tenantId")),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CashController.prototype, "export", null);
exports.CashController = CashController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, tenant_context_guard_1.TenantContextGuard),
    (0, common_1.Controller)("tenants/:tenantId/cash"),
    __metadata("design:paramtypes", [cash_service_1.CashService])
], CashController);
