import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Headers,
  Query,
  ForbiddenException,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthUser } from "../auth/jwt.strategy";
import { TenantId } from "../common/tenant/tenant.decorator";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersQueryDto } from "./dto/orders-query.dto";
import { AppendItemsDto } from "./dto/append-items.dto";
import { FireDto } from "./dto/fire.dto";
import { VoidItemDto } from "./dto/void-item.dto";
import { CloseOrderDto } from "./dto/close-order.dto";

import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
} from "@nestjs/swagger";
import {
  Idempotent,
  IDEMPOTENCY_FORBIDDEN,
} from "../common/idempotency/idempotency.decorator";
import { presentOrder } from "./order.presenter";

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard) // TenantContext guard global já ativo
@Controller("tenants/:tenantId/orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: "Criar comanda (ORDER OPEN) - Idempotente" })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "UUID v4 por request",
  })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "Valor fixo: orders:create",
  })
  @ApiResponse({ status: 201, description: "Order criada" })
  @ApiParam({ name: "tenantId", type: "string", format: "uuid" })
  @Roles("ADMIN", "MODERATOR", "USER")
  @Idempotent("orders:create")
  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
    @Headers("idempotency-key") _idempotencyKey?: string // o interceptor já valida/usa
  ) {
    const order = await this.ordersService.create(tenantId, user, dto);
    return presentOrder(order);
  }

  @ApiOperation({ summary: "Listar comandas do tenant (filtros/paginação)" })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: "tenantId", type: "string", format: "uuid" })
  @Roles("ADMIN", "MODERATOR", "USER")
  @Idempotent(IDEMPOTENCY_FORBIDDEN) // evita clientes enviarem headers idem por engano
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: OrdersQueryDto
  ) {
    const result = await this.ordersService.findAll(tenantId, user, query);
    return {
      ...result,
      items: result.items.map(presentOrder),
    };
  }

  @ApiOperation({ summary: "Obter comanda por ID (detalhe)" })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: "tenantId", type: "string", format: "uuid" })
  @Roles("ADMIN", "MODERATOR", "USER")
  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @Get(":id")
  async findOne(
    @TenantId() tenantId: string,
    @CurrentUser() _user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string
  ) {
    const order = await this.ordersService.findOne(tenantId, id, {
      includePayments: true,
    });
    return presentOrder(order);
  }

  @ApiOperation({ summary: "Adicionar itens STAGED na comanda" })
  @ApiHeader({
    name: "If-Match",
    required: false,
    description: 'Versão atual (ex.: 5, "5" ou W/"5")',
  })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "orders:append-items (ou orders:items:append)",
  })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: "tenantId", type: "string", format: "uuid" })
  @Roles("ADMIN", "MODERATOR", "USER")
  @Idempotent(["orders:append-items", "orders:items:append"])
  @Post(":id/items")
  async appendItems(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AppendItemsDto,
    @Headers("if-match") ifMatch?: string
  ) {
    const order = await this.ordersService.appendItems(
      tenantId,
      user,
      id,
      dto,
      ifMatch
    );
    return presentOrder(order);
  }

  @ApiOperation({ summary: "Disparar (FIRE) itens STAGED para produção" })
  @ApiHeader({ name: "If-Match", required: false })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "Valor fixo: orders:fire",
  })
  @ApiResponse({
    status: 200,
    description: "Itens marcados como FIRED e estoque debitado",
  })
  @ApiParam({ name: "tenantId", type: "string", format: "uuid" })
  @Roles("ADMIN", "MODERATOR", "USER")
  @Idempotent("orders:fire")
  @Post(":id/fire")
  async fireItems(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: FireDto,
    @Headers("if-match") ifMatch?: string
  ) {
    const order = await this.ordersService.fireItems(
      tenantId,
      user,
      id,
      dto,
      ifMatch
    );
    return presentOrder(order);
  }

  @ApiOperation({ summary: "VOID de item FIRED (requer aprovação extra)" })
  @ApiHeader({ name: "If-Match", required: false })
  @ApiHeader({
    name: "X-Approval-Token",
    required: true,
    description: 'JWT de MODERATOR/ADMIN/SUPERADMIN (pode ser "Bearer ...")',
  })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "orders:void-item (ou orders:items:void)",
  })
  @ApiResponse({
    status: 200,
    description: "Item anulado e estoque recreditado",
  })
  @ApiParam({ name: "tenantId", type: "string", format: "uuid" })
  @Roles("ADMIN", "MODERATOR", "USER")
  @Idempotent(["orders:void-item", "orders:items:void"])
  @Post(":id/items/:itemId/void")
  async voidItem(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Body() dto: VoidItemDto,
    @Headers("x-approval-token") approvalToken?: string,
    @Headers("if-match") ifMatch?: string
  ) {
    if (!approvalToken) {
      throw new ForbiddenException("Aprovação requerida (X-Approval-Token).");
    }
    const order = await this.ordersService.voidItem(
      tenantId,
      user,
      id,
      itemId,
      dto,
      approvalToken,
      ifMatch
    );
    return presentOrder(order);
  }

  @ApiOperation({ summary: "Cancelar comanda (somente sem itens ativos)" })
  @ApiHeader({ name: "If-Match", required: false })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "Valor fixo: orders:cancel",
  })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: "tenantId", type: "string", format: "uuid" })
  @Roles("ADMIN", "MODERATOR")
  @Idempotent("orders:cancel")
  @Post(":id/cancel")
  async cancel(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("if-match") ifMatch?: string
  ) {
    const order = await this.ordersService.cancel(tenantId, user, id, ifMatch);
    return presentOrder(order);
  }

  @ApiOperation({
    summary: "Fechar comanda (handoff para módulo de Pagamentos/Caixa)",
  })
  @ApiHeader({ name: "If-Match", required: false })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "Valor fixo: orders:close",
  })
  @ApiResponse({ status: 200 })
  @ApiParam({ name: "tenantId", type: "string", format: "uuid" })
  @Roles("ADMIN", "MODERATOR", "USER") // garçom pode fechar
  @Idempotent("orders:close")
  @Post(":id/close")
  async close(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CloseOrderDto,
    @Headers("if-match") ifMatch?: string
  ) {
    const order = await this.ordersService.close(
      tenantId,
      user,
      id,
      dto,
      ifMatch
    );
    return presentOrder(order);
  }
}
