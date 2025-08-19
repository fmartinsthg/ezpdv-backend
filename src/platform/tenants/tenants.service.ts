// src/platform/tenants/tenants.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTenantDto) {
    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
      },
      select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
    });
  }

  async findAll(page = 1, limit = 10) {
    const take = Math.min(Number(limit) || 10, 100);
    const skip = (Number(page) - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.tenant.count(),
    ]);

    return {
      items,
      page: Number(page),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    };
  }

  update(id: string, dto: UpdateTenantDto) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        // isActive: dto.isActive, // se existir no schema
      },
      select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
    });
  }
}
