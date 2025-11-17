import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { SystemRole, TenantRole } from "@prisma/client";
import { TenantId } from "../common/tenant/tenant.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthUser } from "../auth/jwt.strategy";
import { Idempotent } from "../common/idempotency/idempotency.decorator";

import { PaymentsFacadeService } from "./payments-facade.service";
import { CreatePaymentFromFacadeDto } from "./dto/create-payment-facade.dto";
import { RefundPaymentFromFacadeDto } from "./dto/refund-payment-facade.dto";

@ApiTags("PaymentsFacade")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PaymentsFacadeController {
  constructor(private readonly facade: PaymentsFacadeService) {}

  @Post("tenants/:tenantId/orders/:orderId/payments")
  @Roles(
    SystemRole.SUPERADMIN,
    TenantRole.ADMIN,
    TenantRole.MODERATOR,
    TenantRole.USER
  )
  @Idempotent("payments:capture")
  @ApiOperation({
    summary: "Captura pagamento (usa façade para orquestrar Payment + Intent)",
  })
  async capture(
    @TenantId() tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePaymentFromFacadeDto
  ) {
    const userId = (user as any)?.id ?? (user as any)?.sub;
    return this.facade.capture(tenantId, orderId, userId, body);
  }

  @Post("tenants/:tenantId/orders/:orderId/payments/:paymentId/refunds")
  @Roles(SystemRole.SUPERADMIN, TenantRole.ADMIN, TenantRole.MODERATOR)
  @Idempotent("payments:refund")
  @ApiOperation({ summary: "Estorna um pagamento (façade)" })
  async refund(
    @TenantId() tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: RefundPaymentFromFacadeDto
  ) {
    const userId = (user as any)?.id ?? (user as any)?.sub;
    return this.facade.refund(tenantId, orderId, paymentId, userId, body);
  }

  @Get("tenants/:tenantId/orders/:orderId/payments")
  @Roles(
    SystemRole.SUPERADMIN,
    TenantRole.ADMIN,
    TenantRole.MODERATOR,
    TenantRole.USER
  )
  @ApiOperation({ summary: "Lista pagamentos da ordem + resumo + intent" })
  async listByOrder(
    @TenantId() tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string
  ) {
    return this.facade.listByOrder(tenantId, orderId);
  }

  @Get("tenants/:tenantId/orders/:orderId/payments/:paymentId/transactions")
  @Roles(
    SystemRole.SUPERADMIN,
    TenantRole.ADMIN,
    TenantRole.MODERATOR,
    TenantRole.USER
  )
  @ApiOperation({
    summary: "Lista transações de um pagamento (CAPTURE/REFUND/CANCEL)",
  })
  async listTransactions(
    @TenantId() tenantId: string,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string
  ) {
    return this.facade.listTransactions(tenantId, orderId, paymentId);
  }
}
