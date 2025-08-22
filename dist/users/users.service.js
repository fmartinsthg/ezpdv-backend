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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** ADMIN/MODERATOR podem gerenciar; SUPERADMIN sempre pode */
    canManage(user) {
        if (user.systemRole === client_1.SystemRole.SUPERADMIN)
            return true;
        return user.role === client_1.TenantRole.ADMIN || user.role === client_1.TenantRole.MODERATOR;
    }
    /** Resolve tenant alvo: prioridade ao override do controller (req.tenantId) */
    resolveTargetTenantId(user, dtoTenantId, overrideTenantId) {
        if (overrideTenantId)
            return overrideTenantId;
        if (user.systemRole === client_1.SystemRole.SUPERADMIN) {
            const target = user.tenantId ?? dtoTenantId;
            if (!target) {
                throw new common_1.BadRequestException("SUPERADMIN precisa informar tenantId para operar.");
            }
            return target;
        }
        if (!user.tenantId) {
            throw new common_1.ForbiddenException("Contexto de restaurante não definido.");
        }
        return user.tenantId;
    }
    /** Lista usuários do restaurante (por membership) */
    async findAll(user, tenantIdOverride) {
        const tenantId = this.resolveTargetTenantId(user, undefined, tenantIdOverride);
        const memberships = await this.prisma.userTenant.findMany({
            where: { tenantId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        active: true,
                        systemRole: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: { role: "asc" },
        });
        return memberships.map((m) => ({
            ...m.user,
            tenantRole: m.role,
        }));
    }
    /** Busca usuário por id, restrito ao tenant */
    async findById(user, id, tenantIdOverride) {
        const tenantId = this.resolveTargetTenantId(user, undefined, tenantIdOverride);
        const membership = await this.prisma.userTenant.findFirst({
            where: { tenantId, userId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        active: true,
                        systemRole: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });
        if (!membership)
            throw new common_1.NotFoundException("Usuário não encontrado.");
        return { ...membership.user, tenantRole: membership.role };
    }
    /** Usado pelo AuthService (sem escopo de tenant aqui) */
    async findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
            include: { memberships: true },
        });
    }
    /**
     * Cria (ou vincula) um usuário ao tenant
     * - Se já existir usuário com o email, cria apenas o membership (se não existir)
     * - Se não existir, cria o user + membership
     */
    async create(current, data, tenantIdOverride) {
        const tenantId = this.resolveTargetTenantId(current, data.tenantId, tenantIdOverride);
        if (!this.canManage(current)) {
            throw new common_1.ForbiddenException("Sem permissão para criar usuários.");
        }
        if (!data.role) {
            throw new common_1.BadRequestException("role (TenantRole) é obrigatório.");
        }
        if (!Object.values(client_1.TenantRole).includes(data.role)) {
            throw new common_1.BadRequestException(`Role inválido. Permitidos: ${Object.values(client_1.TenantRole).join(", ")}`);
        }
        let hashedPassword;
        if (data.password) {
            const salt = await bcrypt.genSalt();
            hashedPassword = await bcrypt.hash(data.password, salt);
        }
        const existing = await this.prisma.user.findUnique({
            where: { email: data.email },
            include: { memberships: { where: { tenantId } } },
        });
        if (existing) {
            if (existing.memberships.length > 0) {
                throw new common_1.BadRequestException("Usuário já está vinculado a este restaurante.");
            }
            const membership = await this.prisma.userTenant.create({
                data: {
                    userId: existing.id,
                    tenantId,
                    role: data.role,
                },
            });
            if (hashedPassword) {
                await this.prisma.user.update({
                    where: { id: existing.id },
                    data: { password: hashedPassword },
                });
            }
            return {
                id: existing.id,
                name: existing.name,
                email: existing.email,
                active: existing.active,
                systemRole: existing.systemRole,
                tenantRole: membership.role,
                createdAt: existing.createdAt,
                updatedAt: existing.updatedAt,
            };
        }
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        name: data.name,
                        email: data.email,
                        password: hashedPassword ?? (await bcrypt.hash("changeme", 10)),
                        active: true,
                        systemRole: client_1.SystemRole.NONE,
                    },
                });
                const membership = await tx.userTenant.create({
                    data: {
                        userId: created.id,
                        tenantId,
                        role: data.role,
                    },
                });
                return { created, membership };
            });
            return {
                id: result.created.id,
                name: result.created.name,
                email: result.created.email,
                active: result.created.active,
                systemRole: result.created.systemRole,
                tenantRole: result.membership.role,
                createdAt: result.created.createdAt,
                updatedAt: result.created.updatedAt,
            };
        }
        catch (e) {
            if (e.code === "P2002") {
                throw new common_1.BadRequestException("E-mail já está em uso.");
            }
            throw e;
        }
    }
    /**
     * Atualiza dados do usuário no tenant (nome/email/senha, e papel no tenant)
     * - Se `role` vier: atualiza o membership do tenant.
     */
    async update(current, id, data, tenantIdOverride) {
        const tenantId = this.resolveTargetTenantId(current, undefined, tenantIdOverride);
        if (!this.canManage(current)) {
            throw new common_1.ForbiddenException("Sem permissão para atualizar usuários.");
        }
        const membership = await this.prisma.userTenant.findFirst({
            where: { tenantId, userId: id },
        });
        if (!membership)
            throw new common_1.NotFoundException("Usuário não encontrado.");
        const userData = {};
        if (data.name !== undefined)
            userData.name = data.name;
        if (data.email !== undefined)
            userData.email = data.email;
        if (data.password) {
            const salt = await bcrypt.genSalt();
            userData.password = await bcrypt.hash(data.password, salt);
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const updated = Object.keys(userData).length
                ? await tx.user.update({
                    where: { id },
                    data: userData,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        active: true,
                        systemRole: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                })
                : await tx.user.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        active: true,
                        systemRole: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                });
            if (!updated) {
                throw new common_1.NotFoundException("Usuário não encontrado.");
            }
            if (data.role !== undefined) {
                if (data.role !== null &&
                    !Object.values(client_1.TenantRole).includes(data.role)) {
                    throw new common_1.BadRequestException(`Role inválido. Permitidos: ${Object.values(client_1.TenantRole).join(", ")}`);
                }
                if (data.role === null) {
                    await tx.userTenant.delete({
                        where: { userId_tenantId: { userId: id, tenantId } },
                    });
                }
                else {
                    await tx.userTenant.update({
                        where: { userId_tenantId: { userId: id, tenantId } },
                        data: { role: data.role },
                    });
                }
            }
            const currentMembership = await tx.userTenant.findUnique({
                where: { userId_tenantId: { userId: id, tenantId } },
            });
            return {
                ...updated,
                tenantRole: currentMembership?.role ?? null,
            };
        });
        return result;
    }
    /**
     * Remove o usuário do tenant (desvincula membership).
     */
    async delete(current, id, tenantIdOverride) {
        const tenantId = this.resolveTargetTenantId(current, undefined, tenantIdOverride);
        if (!this.canManage(current)) {
            throw new common_1.ForbiddenException("Sem permissão para remover usuários.");
        }
        const membership = await this.prisma.userTenant.findFirst({
            where: { tenantId, userId: id },
        });
        if (!membership)
            throw new common_1.NotFoundException("Usuário não encontrado.");
        await this.prisma.userTenant.delete({
            where: { userId_tenantId: { userId: id, tenantId } },
        });
        return { ok: true };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
