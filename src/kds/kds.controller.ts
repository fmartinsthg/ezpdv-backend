import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { KdsService } from "./kds.service";
import {
  KdsListItemsQueryDto,
  KdsListTicketsQueryDto,
  BulkCompleteDto,
} from "./dto/kds-query.dto";
import { PrepStation, OrderItemStatus } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { TenantContextGuard } from "../common/tenant/tenant-context.guard";

@Controller("/tenants/:tenantId/kds")
@UseGuards(JwtAuthGuard, TenantContextGuard, RolesGuard)
@Roles("ADMIN", "MODERATOR", "USER")
export class KdsController {
  constructor(private readonly service: KdsService) {}

  @Get("tickets")
  async listTickets(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Query() q: KdsListTicketsQueryDto
  ) {
    const station = String(q.station || "").toUpperCase() as PrepStation;
    const status = String(
      q.status ?? OrderItemStatus.FIRED
    ).toUpperCase() as OrderItemStatus;
    return this.service.listTickets(tenantId, station, status, q.since, {
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  @Get("items")
  async listItems(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Query() q: KdsListItemsQueryDto
  ) {
    const station = String(q.station || "").toUpperCase() as PrepStation;
    const status = String(
      q.status ?? OrderItemStatus.FIRED
    ).toUpperCase() as OrderItemStatus;
    return this.service.listItems(tenantId, station, status, {
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  @Post("items/:itemId/complete")
  async completeItem(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Req() req: any
  ) {
    return this.service.completeItem(tenantId, itemId, req.user.userId);
  }

  @Post("items/bulk-complete")
  async bulkComplete(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Body() body: BulkCompleteDto,
    @Req() req: any
  ) {
    return this.service.bulkComplete(tenantId, body.itemIds, req.user.userId);
  }

  @Post("tickets/:orderId/bump")
  async bumpTicket(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Headers("if-match") ifMatch: string,
    @Req() req: any
  ) {
    return this.service.bumpTicket(tenantId, orderId, ifMatch, req.user.userId);
  }

  @Post("tickets/:orderId/recall")
  async recallTicket(
    @Param("tenantId", new ParseUUIDPipe()) tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Req() req: any
  ) {
    return this.service.recallTicket(tenantId, orderId, req.user.userId);
  }
}
