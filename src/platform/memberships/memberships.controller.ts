import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/jwt.strategy';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';

@UseGuards(JwtAuthGuard)
@Controller('tenants/:tenantId/memberships')
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  /** Decide o tenant efetivo (SUPERADMIN pode qualquer, ADMIN só o próprio) */
  private resolveTenantScope(user: AuthUser, routeTenantId: string): string {
    if (user.systemRole === 'SUPERADMIN') return routeTenantId;
    if (!user.tenantId || user.tenantId !== routeTenantId) {
      throw new ForbiddenException('Operação não permitida para este tenant.');
    }
    return routeTenantId;
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Param('tenantId', new ParseUUIDPipe()) tenantIdParam: string,
  ) {
    const tenantId = this.resolveTenantScope(user, tenantIdParam);
    return this.service.list(user, tenantId);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('tenantId', new ParseUUIDPipe()) tenantIdParam: string,
    @Body() dto: CreateMembershipDto,
  ) {
    const tenantId = this.resolveTenantScope(user, tenantIdParam);
    return this.service.create(user, tenantId, dto);
  }

  // (Opcional) Remoção de vínculo
  @Delete(':userId')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('tenantId', new ParseUUIDPipe()) tenantIdParam: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ) {
    const tenantId = this.resolveTenantScope(user, tenantIdParam);
    return this.service.remove(user, tenantId, targetUserId);
  }
}
