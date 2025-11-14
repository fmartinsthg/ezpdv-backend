import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";
import { CancelPaymentDto } from "./dto/cancel-payment.dto";
import { QueryPaymentsDto } from "./dto/query-payments.dto";

import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthUser } from "../auth/jwt.strategy";
import { TenantId } from "../common/tenant/tenant.decorator";

import { PaymentsApprovalGuard } from "./payments.approval.guard";
import {
  Idempotent,
  IDEMPOTENCY_FORBIDDEN,
} from "../common/idempotency/idempotency.decorator";

// Guards específicos de caixa nos métodos
import {
  RequireOpenCashSessionGuard,
  AllowWithoutCashSession,
} from "../cash/guards/require-open-cash-session.guard";

@ApiTags("payments")
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("tenants/:tenantId/orders/:orderId/payments")
  @Roles("SUPERADMIN", "ADMIN", "MODERATOR", "USER")
  @HttpCode(201)
  @Idempotent("payments:capture")
  @UseGuards(RequireOpenCashSessionGuard)
  @ApiOperation({
    summary:
      "Captura de pagamento (associação automática à CashSession OPEN do dia)",
  })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "UUID por request",
  })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "Valor fixo: payments:capture",
  })
  @ApiHeader({
    name: "X-Station-Id",
    required: false,
    description:
      "Identificador da estação (ex.: bar-01) — opcionalmente usado para UX/relatórios",
    example: "bar-01",
  })
  @ApiParam({
    name: "tenantId",
    example: "eeb5f3a5-9f0f-4f64-9a63-1d1d91de0e5b",
  })
  @ApiParam({
    name: "orderId",
    example: "6fbc4c11-5b30-4ab6-a1a9-2b20b847da0b",
  })
  @ApiResponse({ status: 201, description: "Pagamento capturado" })
  @ApiResponse({ status: 409, description: "Conflito de soma ou idempotência" })
  async createAndCapture(
    @TenantId() tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: any
  ) {
    const actorId =
      (user as any)?.userId ?? (user as any)?.id ?? (user as any)?.sub;
    if (!actorId)
      throw new BadRequestException(
        "Invalid authenticated user (missing id/sub)."
      );

    dto.orderId = orderId;
    const stationId = req.headers["x-station-id"] as string | undefined;

    return this.payments.capture(tenantId, dto, actorId, stationId);
  }

  @Get("tenants/:tenantId/orders/:orderId/payments")
  @Roles("SUPERADMIN", "ADMIN", "MODERATOR", "USER")
  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @AllowWithoutCashSession()
  @ApiOperation({ summary: "Lista pagamentos de uma ordem" })
  async listByOrder(
    @TenantId() tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string
  ) {
    return this.payments.listByOrder(tenantId, orderId);
  }

  @Get("tenants/:tenantId/payments")
  @Roles("SUPERADMIN", "ADMIN", "MODERATOR")
  @Idempotent(IDEMPOTENCY_FORBIDDEN)
  @AllowWithoutCashSession()
  @ApiOperation({ summary: "Lista pagamentos do tenant (filtros + paginação)" })
  async listByTenant(
    @TenantId() tenantId: string,
    @Query() query: QueryPaymentsDto
  ) {
    return this.payments.listByTenant(tenantId, query);
  }

  @Post("tenants/:tenantId/payments/:paymentId/refund")
  @Roles("SUPERADMIN", "ADMIN", "MODERATOR")
  @UseGuards(PaymentsApprovalGuard, RequireOpenCashSessionGuard)
  @Idempotent("payments:refund")
  @ApiOperation({ summary: "Estorno total/parcial de um pagamento CAPTURED" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "Valor fixo: payments:refund",
  })
  @ApiHeader({
    name: "X-Approval-Token",
    required: true,
    description: "JWT válido com role MODERATOR/ADMIN/SUPERADMIN",
  })
  @ApiParam({
    name: "paymentId",
    example: "b9a7a6d9-2a6d-4d8a-8a71-9e8f3fddf6d0",
  })
  async refund(
    @TenantId() tenantId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: any
  ) {
    const approvalUserId =
      req?.approvalUser?.userId ??
      req?.approvalUser?.id ??
      req?.approvalUser?.sub;
    if (!approvalUserId)
      throw new BadRequestException("Missing approval user id/sub");

    return this.payments.refund(tenantId, paymentId, dto, approvalUserId);
  }

  @Post("tenants/:tenantId/payments/:paymentId/cancel")
  @Roles("SUPERADMIN", "ADMIN", "MODERATOR")
  @UseGuards(PaymentsApprovalGuard, RequireOpenCashSessionGuard)
  @Idempotent("payments:cancel")
  @ApiOperation({ summary: "Cancelamento de um pagamento PENDING" })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiHeader({
    name: "Idempotency-Scope",
    required: true,
    description: "Valor fixo: payments:cancel",
  })
  @ApiHeader({ name: "X-Approval-Token", required: true })
  @ApiParam({
    name: "paymentId",
    example: "b9a7a6d9-2a6d-4d8a-8a71-9e8f3fddf6d0",
  })
  async cancel(
    @TenantId() tenantId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string,
    @Body() dto: CancelPaymentDto,
    @Req() req: any
  ) {
    const approvalUserId =
      req?.approvalUser?.userId ??
      req?.approvalUser?.id ??
      req?.approvalUser?.sub;
    if (!approvalUserId)
      throw new BadRequestException("Missing approval user id/sub");

    return this.payments.cancel(tenantId, paymentId, dto, approvalUserId);
  }
}
