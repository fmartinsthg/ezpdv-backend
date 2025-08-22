import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantId } from '../common/tenant/tenant.decorator';

import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Listar usuários do restaurante' })
  @ApiResponse({ status: 200 })
  @Get()
  findAll(@TenantId() tenantId: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user, tenantId);
  }

  @ApiOperation({ summary: 'Obter usuário do restaurante por ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @Get(':id')
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.usersService.findById(user, id, tenantId);
  }

  @ApiOperation({ summary: 'Criar/vincular usuário ao restaurante' })
  @ApiResponse({ status: 201 })
  @Roles('ADMIN', 'MODERATOR')
  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(user, dto, tenantId);
  }

  @ApiOperation({ summary: 'Atualizar usuário do restaurante' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @Roles('ADMIN', 'MODERATOR')
  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user, id, dto, tenantId);
  }

  @ApiOperation({ summary: 'Remover usuário do restaurante (desvincular)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @Roles('ADMIN', 'MODERATOR')
  @Delete(':id')
  delete(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.usersService.delete(user, id, tenantId);
  }
}
