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
exports.RequireOpenCashSessionGuard = exports.AllowWithoutCashSession = exports.ALLOW_WITHOUT_CASH_SESSION_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("../../prisma/prisma.service");
/** Decorator para rotas que NÃO exigem sessão de caixa aberta */
exports.ALLOW_WITHOUT_CASH_SESSION_KEY = "ALLOW_WITHOUT_CASH_SESSION";
const AllowWithoutCashSession = () => (target, key, desc) => {
    Reflect.defineMetadata(exports.ALLOW_WITHOUT_CASH_SESSION_KEY, true, desc ? desc.value : target);
    return desc ?? target;
};
exports.AllowWithoutCashSession = AllowWithoutCashSession;
/**
 * Exige sessão de caixa ABERTA por tenant.
 * Se CASH_REQUIRE_TODAY=true, a sessão precisa ter sido aberta "hoje"
 * no fuso definido por CASH_TZ_OFFSET_MIN (minutos; default -180 = UTC-03).
 */
let RequireOpenCashSessionGuard = class RequireOpenCashSessionGuard {
    constructor(prisma, reflector) {
        this.prisma = prisma;
        this.reflector = reflector;
    }
    async canActivate(ctx) {
        const allow = this.reflector.get(exports.ALLOW_WITHOUT_CASH_SESSION_KEY, ctx.getHandler());
        if (allow)
            return true;
        const req = ctx.switchToHttp().getRequest();
        const tenantId = req?.tenantId;
        if (!tenantId) {
            throw new common_1.ForbiddenException("Contexto do restaurante (tenant) não encontrado.");
        }
        const requireToday = String(process.env.CASH_REQUIRE_TODAY || "").toLowerCase() === "true";
        let session = null;
        if (requireToday) {
            const tzOffsetMin = Number(process.env.CASH_TZ_OFFSET_MIN ?? -180); // Fortaleza padrão
            const nowUtc = new Date();
            const nowLocalMs = nowUtc.getTime() + tzOffsetMin * 60_000;
            const local = new Date(nowLocalMs);
            const startLocal = new Date(local);
            startLocal.setHours(0, 0, 0, 0);
            const endLocal = new Date(local);
            endLocal.setHours(23, 59, 59, 999);
            const startUtc = new Date(startLocal.getTime() - tzOffsetMin * 60_000);
            const endUtc = new Date(endLocal.getTime() - tzOffsetMin * 60_000);
            session = await this.prisma.cashSession.findFirst({
                where: {
                    tenantId,
                    status: "OPEN",
                    openedAt: { gte: startUtc, lte: endUtc },
                },
                select: { id: true },
            });
        }
        else {
            session = await this.prisma.cashSession.findFirst({
                where: { tenantId, status: "OPEN" },
                select: { id: true },
            });
        }
        if (!session) {
            throw new common_1.ConflictException("Não há sessão de caixa ABERTA para este restaurante. Abra o caixa para continuar.");
        }
        req.cashSession = session; // útil nos services
        return true;
    }
};
exports.RequireOpenCashSessionGuard = RequireOpenCashSessionGuard;
exports.RequireOpenCashSessionGuard = RequireOpenCashSessionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        core_1.Reflector])
], RequireOpenCashSessionGuard);
