import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, TenantRole, SystemRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Helper: só ADMIN/MODERATOR podem gerenciar usuários do tenant */
  private canManage(role?: TenantRole | null): boolean {
    return role === TenantRole.ADMIN || role === TenantRole.MODERATOR;
  }

  /** Helper: resolve tenant alvo da operação */
  private resolveTargetTenantId(user: AuthUser, dtoTenantId?: string): string {
    if (user.systemRole === SystemRole.SUPERADMIN) {
      // SUPERADMIN precisa de tenantId explícito no token ou dto
      const target = user.tenantId ?? dtoTenantId;
      if (!target) {
        throw new BadRequestException(
          'SUPERADMIN precisa informar tenantId para operar.',
        );
      }
      return target;
    }
    if (!user.tenantId) {
      throw new ForbiddenException('Contexto de restaurante não definido.');
    }
    return user.tenantId;
  }

  /** Lista usuários do restaurante (por membership) */
  async findAll(user: AuthUser) {
    const tenantId = this.resolveTargetTenantId(user);

    // pega memberships do tenant com o usuário vinculado
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
      orderBy: { role: 'asc' },
    });

    return memberships.map((m) => ({
      ...m.user,
      tenantRole: m.role,
    }));
  }

  /** Busca usuário por id, restrito ao tenant */
  async findById(user: AuthUser, id: string) {
    const tenantId = this.resolveTargetTenantId(user);

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

    if (!membership) throw new NotFoundException('Usuário não encontrado.');
    return { ...membership.user, tenantRole: membership.role };
  }

  /** Usado pelo AuthService (sem escopo de tenant aqui) */
  async findByEmail(email: string) {
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
  async create(current: AuthUser, data: CreateUserDto) {
    const tenantId = this.resolveTargetTenantId(current, (data as any).tenantId);

    if (!this.canManage(current.role)) {
      throw new ForbiddenException('Sem permissão para criar usuários.');
    }

    if (!data.role) {
      throw new BadRequestException('role (TenantRole) é obrigatório.');
    }

    // valida TenantRole
    if (!Object.values(TenantRole).includes(data.role as TenantRole)) {
      throw new BadRequestException(
        `Role inválido. Permitidos: ${Object.values(TenantRole).join(', ')}`,
      );
    }

    // senha (se enviado)
    let hashedPassword: string | undefined;
    if (data.password) {
      const salt = await bcrypt.genSalt();
      hashedPassword = await bcrypt.hash(data.password, salt);
    }

    // verifica se já existe usuário com email
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { memberships: { where: { tenantId } } },
    });

    if (existing) {
      // se já tem membership para o tenant, erro
      if (existing.memberships.length > 0) {
        throw new BadRequestException(
          'Usuário já está vinculado a este restaurante.',
        );
      }

      // vincula ao tenant
      const membership = await this.prisma.userTenant.create({
        data: {
          userId: existing.id,
          tenantId,
          role: data.role as TenantRole,
        },
      });

      // atualiza senha se enviada (opcional)
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

    // cria user + membership em transação
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            password: hashedPassword ?? (await bcrypt.hash('changeme', 10)), // fallback
            active: true,
            systemRole: SystemRole.NONE,
          },
        });

        const membership = await tx.userTenant.create({
          data: {
            userId: created.id,
            tenantId,
            role: data.role as TenantRole,
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
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException('E-mail já está em uso.');
      }
      throw e;
    }
  }

  /**
   * Atualiza dados do usuário no tenant (nome/email/senha, e papel no tenant)
   * - Se `role` vier: atualiza o membership do tenant.
   */
  async update(current: AuthUser, id: string, data: UpdateUserDto) {
    const tenantId = this.resolveTargetTenantId(current);

    if (!this.canManage(current.role)) {
      throw new ForbiddenException('Sem permissão para atualizar usuários.');
    }

    // garante que o user pertence ao tenant
    const membership = await this.prisma.userTenant.findFirst({
      where: { tenantId, userId: id },
    });
    if (!membership) throw new NotFoundException('Usuário não encontrado.');

    // prepara campos de user
    const userData: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) userData.name = data.name;
    if (data.email !== undefined) userData.email = data.email;
    if (data.password) {
      const salt = await bcrypt.genSalt();
      userData.password = await bcrypt.hash(data.password, salt);
    }

    // executa transação (update user + update membership role se enviado)
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
        throw new NotFoundException('Usuário não encontrado.');
      }

      if (data.role !== undefined) {
        if (
          data.role !== null &&
          !Object.values(TenantRole).includes(data.role as TenantRole)
        ) {
          throw new BadRequestException(
            `Role inválido. Permitidos: ${Object.values(TenantRole).join(', ')}`,
          );
        }

        if (data.role === null) {
          // opcional: remover vínculo do tenant
          await tx.userTenant.delete({
            where: { userId_tenantId: { userId: id, tenantId } },
          });
        } else {
          await tx.userTenant.update({
            where: { userId_tenantId: { userId: id, tenantId } },
            data: { role: data.role as TenantRole },
          });
        }
      }

      // retorna com role atual
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
   * Remove o usuário do tenant (exclui o membership). Se não restarem memberships,
   * opcionalmente poderíamos excluir o usuário — aqui vamos **apenas** desvincular.
   */
  async delete(current: AuthUser, id: string) {
    const tenantId = this.resolveTargetTenantId(current);

    if (!this.canManage(current.role)) {
      throw new ForbiddenException('Sem permissão para remover usuários.');
    }

    // garante que existe membership no tenant
    const membership = await this.prisma.userTenant.findFirst({
      where: { tenantId, userId: id },
    });
    if (!membership) throw new NotFoundException('Usuário não encontrado.');

    await this.prisma.userTenant.delete({
      where: { userId_tenantId: { userId: id, tenantId } },
    });

    return { ok: true };
  }
}
