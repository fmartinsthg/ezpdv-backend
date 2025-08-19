// src/platform/tenants/tenants.controller.ts
import {
  Controller, Post, Get, Patch,
  Body, Query, Param, UseGuards, ForbiddenException, ParseUUIDPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/jwt.strategy';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  private ensureSuperAdmin(user: AuthUser) {
    if (user.systemRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Acesso restrito ao SUPERADMIN.');
    }
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTenantDto) {
    this.ensureSuperAdmin(user);
    return this.tenantsService.create(dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureSuperAdmin(user);
    return this.tenantsService.findAll(Number(page) || 1, Number(limit) || 10);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    this.ensureSuperAdmin(user);
    return this.tenantsService.update(id, dto);
  }
}
