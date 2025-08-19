import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { TenantRole } from '@prisma/client';
import { AuthUser } from '../../auth/jwt.strategy';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Permite SUPERADMIN em qualquer tenant; ADMIN somente no próprio tenant */
  private async assertCanManageTenant(user: AuthUser, tenantId: string) {
    if (user.systemRole === 'SUPERADMIN') return;

    if (!user.tenantId || user.tenantId !== tenantId) {
      throw new ForbiddenException('Você só pode gerenciar o seu próprio restaurante.');
    }

    const myMembership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: user.userId, tenantId } },
      select: { role: true },
    });

    if (!myMembership || myMembership.role !== TenantRole.ADMIN) {
      throw new ForbiddenException('Apenas ADMIN do restaurante pode gerenciar membros.');
    }
  }

  async list(user: AuthUser, tenantId: string) {
    await this.assertCanManageTenant(user, tenantId);

    const items = await this.prisma.userTenant.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, name: true, email: true, active: true, systemRole: true } },
      },
      orderBy: { role: 'asc' },
    });

    // normaliza a resposta
    return items.map((m) => ({
      userId: m.userId,
      tenantId: m.tenantId,
      role: m.role,
      user: m.user,
    }));
  }

  async create(user: AuthUser, tenantId: string, dto: CreateMembershipDto) {
    await this.assertCanManageTenant(user, tenantId);

    // garante existência do tenant e do usuário
    const [tenant, targetUser] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
    ]);
    if (!tenant) throw new NotFoundException('Tenant inexistente.');
    if (!targetUser) throw new NotFoundException('Usuário inexistente.');

    // evita duplicidade
    const exists = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: dto.userId, tenantId } },
    });
    if (exists) {
      throw new BadRequestException('Usuário já vinculado a este tenant.');
    }

    try {
      return await this.prisma.userTenant.create({
        data: { userId: dto.userId, tenantId, role: dto.role },
        select: {
          userId: true,
          tenantId: true,
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new BadRequestException('Usuário já vinculado a este tenant.');
      }
      throw e;
    }
  }

  /** (Opcional) Remover membro — protege o único ADMIN */
  async remove(user: AuthUser, tenantId: string, targetUserId: string) {
    await this.assertCanManageTenant(user, tenantId);

    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: targetUserId, tenantId } },
    });
    if (!membership) throw new NotFoundException('Membro não encontrado.');

    if (membership.role === TenantRole.ADMIN) {
      const adminCount = await this.prisma.userTenant.count({
        where: { tenantId, role: TenantRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Não é possível remover o único ADMIN do restaurante.');
      }
    }

    return this.prisma.userTenant.delete({
      where: { userId_tenantId: { userId: targetUserId, tenantId } },
    });
  }
}
