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
exports.RolesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_decorator_1 = require("../decorators/roles.decorator");
let RolesGuard = class RolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(ctx) {
        // Ex.: @Roles('ADMIN','MODERATOR')
        const required = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        // Se a rota não exigiu roles, permite
        if (!required || required.length === 0)
            return true;
        const req = ctx.switchToHttp().getRequest();
        const user = req.user;
        if (!user)
            return false;
        // SUPERADMIN tem passe livre (desde que o tenant middleware
        // já tenha resolvido X-Tenant-Id quando necessário)
        if (user.systemRole === 'SUPERADMIN')
            return true;
        // Se não tem role de tenant, nega
        if (!user.role)
            return false;
        // Normaliza os roles exigidos (strings) para o enum do Prisma
        const requiredEnumRoles = required.map(r => r.toUpperCase());
        return requiredEnumRoles.includes(user.role);
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
