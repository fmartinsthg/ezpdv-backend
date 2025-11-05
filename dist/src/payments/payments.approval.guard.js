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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsApprovalGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
let PaymentsApprovalGuard = class PaymentsApprovalGuard {
    constructor(jwt) {
        this.jwt = jwt;
    }
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const token = req.headers['x-approval-token'];
        if (!token)
            throw new common_1.ForbiddenException('X-Approval-Token header is required');
        try {
            const payload = this.jwt.verify(token);
            const { systemRole, tenantRole, tenantId, sub } = payload || {};
            const paramTenant = req.params?.tenantId;
            const isSuperAdmin = systemRole === client_1.SystemRole.SUPERADMIN;
            const isModeratorOrAdmin = tenantRole === client_1.TenantRole.MODERATOR || tenantRole === client_1.TenantRole.ADMIN;
            if (!isSuperAdmin && !isModeratorOrAdmin) {
                throw new common_1.ForbiddenException('Approval token does not have required role (MODERATOR/ADMIN/SUPERADMIN)');
            }
            if (!isSuperAdmin && paramTenant && tenantId && tenantId !== paramTenant) {
                throw new common_1.ForbiddenException('Approval token tenant mismatch');
            }
            // Anexa aprovador para auditoria (byUserId)
            req.approvalUser = { id: sub, systemRole, tenantRole, tenantId };
            return true;
        }
        catch (err) {
            if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
                throw new common_1.UnauthorizedException('Invalid or expired X-Approval-Token');
            }
            throw err;
        }
    }
};
exports.PaymentsApprovalGuard = PaymentsApprovalGuard;
exports.PaymentsApprovalGuard = PaymentsApprovalGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], PaymentsApprovalGuard);
