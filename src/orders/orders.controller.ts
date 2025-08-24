import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Headers,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { TenantId } from '../common/tenant/tenant.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { AppendItemsDto } from './dto/append-items.dto';
import { FireDto } from './dto/fire.dto';
import { VoidItemDto } from './dto/void-item.dto';
import { CloseOrderDto } from './dto/close-order.dto';

import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard) // TenantContextGuard já está global no seu app.module
@Controller('tenants/:tenantId/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Criar comanda (ORDER OPEN) - Idempotente' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 201, description: 'Order criada' })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @Roles('ADMIN', 'MODERATOR', 'USER')
  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.create(tenantId, user, dto, idempotencyKey);
  }

  @ApiOperation({ summary: 'Listar comandas do tenant (filtros/paginação)' })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @Roles('ADMIN', 'MODERATOR', 'USER')
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: OrdersQueryDto,
  ) {
    return this.ordersService.findAll(tenantId, user, query);
  }

  @ApiOperation({ summary: 'Obter comanda por ID (detalhe)' })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @Roles('ADMIN', 'MODERATOR', 'USER')
  @Get(':id')
  async findOne(
    @TenantId() tenantId: string,
    @CurrentUser() _user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.ordersService.findOne(tenantId, id);
  }

  @ApiOperation({ summary: 'Adicionar itens STAGED na comanda' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @Roles('ADMIN', 'MODERATOR', 'USER')
  @Post(':id/items')
  async appendItems(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AppendItemsDto,
  ) {
    return this.ordersService.appendItems(tenantId, user, id, dto);
  }

  @ApiOperation({ summary: 'Disparar (FIRE) itens STAGED para produção' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 200, description: 'Itens marcados como FIRED e estoque debitado' })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @Roles('ADMIN', 'MODERATOR', 'USER')
  @Post(':id/fire')
  async fireItems(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: FireDto,
  ) {
    return this.ordersService.fireItems(tenantId, user, id, dto);
  }

  @ApiOperation({ summary: 'VOID de item FIRED (requer aprovação extra)' })
  @ApiHeader({ name: 'X-Approval-Token', required: true, description: 'JWT de MODERATOR/ADMIN/SUPERADMIN' })
  @ApiResponse({ status: 200, description: 'Item anulado e estoque recreditado' })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @Roles('ADMIN', 'MODERATOR', 'USER') // USER pode solicitar, mas precisa approval token
  @Post(':id/items/:itemId/void')
  async voidItem(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: VoidItemDto,
    @Headers('x-approval-token') approvalToken?: string,
  ) {
    if (!approvalToken) {
      throw new ForbiddenException('Aprovação requerida (X-Approval-Token).');
    }
    return this.ordersService.voidItem(tenantId, user, id, itemId, dto, approvalToken);
  }

  @ApiOperation({ summary: 'Cancelar comanda (somente sem itens ativos)' })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @Roles('ADMIN', 'MODERATOR')
  @Post(':id/cancel')
  async cancel(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.ordersService.cancel(tenantId, user, id);
  }

  @ApiOperation({ summary: 'Fechar comanda (handoff para Sales)' })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @Roles('ADMIN', 'MODERATOR')
  @Post(':id/close')
  async close(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CloseOrderDto,
  ) {
    return this.ordersService.close(tenantId, user, id, dto);
  }
}
