import {
  Body, Controller, Param, ParseUUIDPipe, Post, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/jwt.guard';
import { CurrentUser } from '../../../auth/current-user.decorator';
import { AuthUser } from '../../../auth/jwt.strategy';
import { TenantUsersService } from './tenant-users.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { TenantRole } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('tenants/:tenantId/users')
export class TenantUsersController {
  constructor(private readonly service: TenantUsersService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() dto: CreateTenantUserDto,
  ) {
    // SUPERADMIN pode criar em qualquer tenant
    if (user.systemRole !== 'SUPERADMIN') {
      if (!user.tenantId || user.tenantId !== tenantId) {
        throw new ForbiddenException('Operação não permitida para este tenant.');
      }
      // somente ADMIN do tenant pode criar usuários
      if (user.role !== 'ADMIN') {
        throw new ForbiddenException('Apenas ADMIN do tenant pode criar usuários.');
      }
    }

    return this.service.createUserAndMembership(tenantId, dto);
  }
}