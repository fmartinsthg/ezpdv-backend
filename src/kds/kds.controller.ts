import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
  Header,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Observable } from "rxjs";
import { KdsService } from "./kds.service";
import {
  KdsListItemsQueryDto,
  KdsListTicketsQueryDto,
  BulkCompleteDto,
} from "./dto/kds-query.dto";
import { PrepStation, OrderItemStatus } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { TenantContextGuard } from "../common/tenant/tenant-context.guard";
import { TenantId } from "../common/tenant/tenant.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthUser } from "../auth/jwt.strategy";
import { KdsBus } from "./kds.bus";

@ApiTags("KDS")
@ApiBearerAuth()
@Controller("/tenants/:tenantId/kds")
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@Roles("ADMIN", "MODERATOR", "USER")
export class KdsController {
  constructor(
    private readonly service: KdsService,
    private readonly bus: KdsBus
  ) {}

  @Get("tickets")
  @ApiOperation({ summary: "Lista tickets do KDS (agrupado por comanda)" })
  async listTickets(
    @TenantId() tenantId: string,
    @Query() q: KdsListTicketsQueryDto
  ) {
    const station = q.station as PrepStation;
    const status = (q.status ?? OrderItemStatus.FIRED) as OrderItemStatus;
    return this.service.listTickets(tenantId, station, status, q.since, {
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  @Get("items")
  @ApiOperation({ summary: "Lista itens do KDS (flat)" })
  async listItems(
    @TenantId() tenantId: string,
    @Query() q: KdsListItemsQueryDto
  ) {
    const station = q.station as PrepStation;
    const status = (q.status ?? OrderItemStatus.FIRED) as OrderItemStatus;
    return this.service.listItems(tenantId, station, status, q.since, {
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  @Post("items/:itemId/complete")
  @ApiOperation({ summary: "Concluir um item (FIRED → CLOSED)" })
  async completeItem(
    @TenantId() tenantId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @CurrentUser() user: AuthUser
  ) {
    const actorId =
      (user as any)?.userId ?? (user as any)?.sub ?? (user as any)?.id;
    return this.service.completeItem(tenantId, itemId, actorId);
  }

  @Post("items/bulk-complete")
  @ApiOperation({ summary: "Concluir vários itens" })
  async bulkComplete(
    @TenantId() tenantId: string,
    @Body() body: BulkCompleteDto,
    @CurrentUser() user: AuthUser
  ) {
    const actorId =
      (user as any)?.userId ?? (user as any)?.sub ?? (user as any)?.id;
    return this.service.bulkComplete(tenantId, body.itemIds, actorId);
  }

  @Post("tickets/:orderId/bump")
  @ApiOperation({ summary: "Bump do ticket (fecha todos FIRED da comanda)" })
  async bumpTicket(
    @TenantId() tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Headers("if-match") ifMatch: string,
    @CurrentUser() user: AuthUser
  ) {
    const actorId =
      (user as any)?.userId ?? (user as any)?.sub ?? (user as any)?.id;
    return this.service.bumpTicket(tenantId, orderId, ifMatch, actorId);
  }

  @Post("tickets/:orderId/recall")
  @ApiOperation({ summary: "Recall do ticket (CLOSED → FIRED)" })
  async recallTicket(
    @TenantId() tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @CurrentUser() user: AuthUser
  ) {
    const actorId =
      (user as any)?.userId ?? (user as any)?.sub ?? (user as any)?.id;
    return this.service.recallTicket(tenantId, orderId, actorId);
  }

  @Sse("stream")
  @ApiOperation({ summary: "SSE: push de eventos do KDS em tempo real" })
  @ApiProduces("text/event-stream")
  // + Anti-buffer/keep-alive (importante atrás de proxies e com compression):
  @Header("Cache-Control", "no-cache")
  @Header("Connection", "keep-alive")
  @Header("X-Accel-Buffering", "no")
  stream(
    @TenantId() tenantId: string,
    @Query("station") station?: PrepStation
  ): Observable<MessageEvent> {
    const st = station
      ? (String(station).toUpperCase() as PrepStation)
      : undefined;
    return this.bus.stream(tenantId, st);
  }
}
