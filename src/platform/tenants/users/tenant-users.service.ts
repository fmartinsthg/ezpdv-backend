import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { SystemRole, TenantRole } from '@prisma/client';

@Injectable()
export class TenantUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUserAndMembership(tenantId: string, dto: CreateTenantUserDto) {
    const role: TenantRole = dto.role ?? TenantRole.USER;

    try {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const result = await this.prisma.$transaction(async (tx) => {
        // cria usuário (systemRole sempre NONE aqui)
        const user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            password: passwordHash,
            systemRole: SystemRole.NONE,
            active: true,
          },
        });

        // vincula ao tenant
        await tx.userTenant.create({
          data: {
            userId: user.id,
            tenantId,
            role,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role,
          tenantId,
        };
      });

      return result;
    } catch (err: any) {
      if (err.code === 'P2002') {
        // email único
        throw new BadRequestException('E-mail já cadastrado.');
      }
      throw err;
    }
  }
}