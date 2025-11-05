import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { CashService } from "./cash.service";
import { OpenSessionDto } from "./dto/open-session.dto";
import { CreateMovementDto } from "./dto/movement.dto";
import { CreateCountDto } from "./dto/count.dto";
import { CloseSessionDto } from "./dto/close-session.dto";
import { ReopenSessionDto } from "./dto/reopen-session.dto";
import { ReassignPaymentDto } from "./dto/reassign-payment.dto";

import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { TenantContextGuard } from "../common/tenant/tenant-context.guard";

// ⬇️ novo
import {
  RequireOpenCashSessionGuard,
  AllowWithoutCashSession,
} from "./guards/require-open-cash-session.guard";

@UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard)
@Controller("tenants/:tenantId/cash")
export class CashController {
  constructor(private readonly service: CashService) {}

  @AllowWithoutCashSession()
  @Get("sessions")
  list(@Param("tenantId") tenantId: string, @Query() q: any) {
    return this.service.listSessions(tenantId, q);
  }

  @AllowWithoutCashSession()
  @Get("sessions/open")
  getOpen(
    @Param("tenantId") tenantId: string,
    @Query("stationId") stationId: string | undefined,
    @Req() req: any
  ) {
    const sid =
      stationId ?? (req.headers["x-station-id"] as string | undefined);
    return this.service.getOpenSession(tenantId, sid);
  }

  @AllowWithoutCashSession()
  @Get("sessions/:sessionId")
  detail(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string
  ) {
    return this.service.getSessionDetail(tenantId, sessionId);
  }

  @AllowWithoutCashSession()
  @Post("sessions/open")
  open(
    @Param("tenantId") tenantId: string,
    @Body() dto: OpenSessionDto,
    @Req() req: any
  ) {
    return this.service.openSession({
      tenantId,
      stationId:
        dto.stationId ?? (req.headers["x-station-id"] as string | undefined),
      openingFloat: dto.openingFloat,
      notes: dto.notes,
      userId: req.user.sub,
      idemScope: req.headers["idempotency-scope"] as string | undefined,
      idemKey: req.headers["idempotency-key"] as string | undefined,
    });
  }

  @UseGuards(RequireOpenCashSessionGuard)
  @Post("sessions/:sessionId/movements")
  movement(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: CreateMovementDto,
    @Req() req: any
  ) {
    return this.service.createMovement({
      tenantId,
      sessionId,
      type: dto.type,
      method: dto.method,
      amount: dto.amount,
      reason: dto.reason,
      userId: req.user.sub,
      idemScope: req.headers["idempotency-scope"] as string | undefined,
      idemKey: req.headers["idempotency-key"] as string | undefined,
    });
  }

  @UseGuards(RequireOpenCashSessionGuard)
  @Post("sessions/:sessionId/counts")
  count(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: CreateCountDto,
    @Req() req: any
  ) {
    return this.service.createCount({
      tenantId,
      sessionId,
      kind: dto.kind,
      denominations: dto.denominations,
      total: dto.total,
      userId: req.user.sub,
      idemScope: req.headers["idempotency-scope"] as string | undefined,
      idemKey: req.headers["idempotency-key"] as string | undefined,
    });
  }

  @UseGuards(RequireOpenCashSessionGuard)
  @Post("sessions/:sessionId/reassign-payment")
  reassign(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: ReassignPaymentDto,
    @Req() req: any
  ) {
    return this.service.reassignPayment({
      tenantId,
      sessionId,
      paymentId: dto.paymentId,
      userId: req.user.sub,
      idemScope: req.headers["idempotency-scope"] as string | undefined,
      idemKey: req.headers["idempotency-key"] as string | undefined,
    });
  }

  @UseGuards(RequireOpenCashSessionGuard)
  @Post("sessions/:sessionId/close")
  close(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: CloseSessionDto,
    @Req() req: any
  ) {
    return this.service.closeSession({
      tenantId,
      sessionId,
      note: dto.note,
      userId: req.user.sub,
      idemScope: req.headers["idempotency-scope"] as string | undefined,
      idemKey: req.headers["idempotency-key"] as string | undefined,
    });
  }

  @UseGuards(RequireOpenCashSessionGuard)
  @Post("sessions/:sessionId/reopen")
  reopen(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: ReopenSessionDto,
    @Req() req: any
  ) {
    return this.service.reopenSession({
      tenantId,
      sessionId,
      reason: dto.reason,
      userId: req.user.sub,
      idemScope: req.headers["idempotency-scope"] as string | undefined,
      idemKey: req.headers["idempotency-key"] as string | undefined,
    });
  }

  @AllowWithoutCashSession()
  @Get("reports/daily")
  reportDaily(
    @Param("tenantId") tenantId: string,
    @Query("date") date: string
  ) {
    return this.service.reportDaily(tenantId, date);
  }

  @AllowWithoutCashSession()
  @Get("reports/sessions-export")
  export(@Param("tenantId") tenantId: string, @Query() q: any) {
    return this.service.exportSessions(tenantId, q);
  }
}
