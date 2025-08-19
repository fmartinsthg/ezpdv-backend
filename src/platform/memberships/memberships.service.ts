// src/platform/memberships/memberships.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const items = await this.prisma.userTenant.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true, active: true, systemRole: true } } },
      orderBy: { role: 'asc' },
    });
    return items.map(m => ({ ...m, user: m.user }));
  }

  async create(tenantId: string, dto: CreateMembershipDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant inexistente.');

    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: dto.userId, tenantId } },
    });
    if (membership) {
      throw new BadRequestException('Usuário já vinculado a este tenant.');
    }

    return this.prisma.userTenant.create({
      data: { userId: dto.userId, tenantId, role: dto.role },
    });
  }
}
