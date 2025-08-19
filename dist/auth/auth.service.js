"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    /** Busca o usuário com memberships e valida a senha */
    async validateUser(email, password) {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { memberships: true }, // pega vínculos com tenants
        });
        if (!user || !user.active) {
            throw new common_1.UnauthorizedException("Credenciais inválidas");
        }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            throw new common_1.UnauthorizedException("Credenciais inválidas");
        }
        return user;
    }
    /** Login com suporte a multi-tenant */
    async login(dto) {
        const user = await this.validateUser(dto.email, dto.password);
        // Determinar o contexto do tenant e o papel dentro do tenant
        let selectedTenantId = null;
        let tenantRole = null;
        if (user.systemRole === client_1.SystemRole.SUPERADMIN) {
            // SUPERADMIN opera sem tenant por padrão (rotas de plataforma)
            selectedTenantId = null;
            tenantRole = null;
        }
        else {
            const memberships = user.memberships;
            if (!memberships || memberships.length === 0) {
                throw new common_1.UnauthorizedException("Usuário não possui acesso a nenhum restaurante.");
            }
            if (dto.tenantId) {
                const m = memberships.find((mm) => mm.tenantId === dto.tenantId);
                if (!m) {
                    throw new common_1.BadRequestException("Usuário não é membro do restaurante informado.");
                }
                selectedTenantId = m.tenantId;
                tenantRole = m.role;
            }
            else if (memberships.length === 1) {
                selectedTenantId = memberships[0].tenantId;
                tenantRole = memberships[0].role;
            }
            else {
                // Usuário pertence a vários tenants e não informou tenantId
                throw new common_1.BadRequestException("Usuário pertence a múltiplos restaurantes. Informe o tenantId no login.");
            }
        }
        const payload = {
            sub: user.id,
            systemRole: user.systemRole, // SUPERADMIN | SUPPORT | NONE
            tenantId: selectedTenantId, // null para SUPERADMIN
            role: tenantRole, // TenantRole no contexto do tenant, ou null
        };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
