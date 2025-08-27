import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { CancelPaymentDto } from './dto/cancel-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SystemRole, TenantRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';

import { PaymentsApprovalGuard } from './payments.approval.guard';
import { Idempotent } from '../common/idempotency/idempotency.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('tenants/:tenantId/orders/:orderId/payments')
  @Roles(SystemRole.SUPERADMIN, TenantRole.ADMIN, TenantRole.MODERATOR, TenantRole.USER)
  @HttpCode(201)
  @Idempotent('payments:capture')
  @ApiOperation({ summary: 'Captura de pagamento para uma ordem CLOSED (split-friendly)' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID por request' })
  @ApiHeader({ name: 'Idempotency-Scope', required: true, description: 'Valor fixo: payments:capture' })
  @ApiParam({ name: 'tenantId', example: 'eeb5f3a5-9f0f-4f64-9a63-1d1d91de0e5b' })
  @ApiParam({ name: 'orderId', example: '6fbc4c11-5b30-4ab6-a1a9-2b20b847da0b' })
  @ApiResponse({ status: 201, description: 'Pagamento capturado' })
  @ApiResponse({ status: 409, description: 'Conflito de soma ou idempotência' })
  async createAndCapture(
    @TenantId() tenantId: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: any,
  ) {
    dto.orderId = orderId;
    return this.payments.capture(tenantId, dto, user.id);
  }

  @Get('tenants/:tenantId/orders/:orderId/payments')
  @Roles(SystemRole.SUPERADMIN, TenantRole.ADMIN, TenantRole.MODERATOR, TenantRole.USER)
  @ApiOperation({ summary: 'Lista pagamentos de uma ordem' })
  async listByOrder(
    @TenantId() tenantId: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ) {
    return this.payments.listByOrder(tenantId, orderId);
  }

  @Get('tenants/:tenantId/payments')
  @Roles(SystemRole.SUPERADMIN, TenantRole.ADMIN, TenantRole.MODERATOR)
  @ApiOperation({ summary: 'Lista pagamentos do tenant (filtros + paginação)' })
  async listByTenant(
    @TenantId() tenantId: string,
    @Query() query: QueryPaymentsDto,
  ) {
    return this.payments.listByTenant(tenantId, query);
  }

  @Post('tenants/:tenantId/payments/:paymentId/refund')
  @Roles(SystemRole.SUPERADMIN, TenantRole.ADMIN, TenantRole.MODERATOR)
  @UseGuards(PaymentsApprovalGuard)
  @Idempotent('payments:refund')
  @ApiOperation({ summary: 'Estorno total/parcial de um pagamento CAPTURED' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'Idempotency-Scope', required: true, description: 'Valor fixo: payments:refund' })
  @ApiHeader({ name: 'X-Approval-Token', required: true, description: 'JWT válido com role MODERATOR/ADMIN/SUPERADMIN' })
  @ApiParam({ name: 'paymentId', example: 'b9a7a6d9-2a6d-4d8a-8a71-9e8f3fddf6d0' })
  async refund(
    @TenantId() tenantId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: any,
  ) {
    const approvalUserId = req?.approvalUser?.id;
    if (!approvalUserId) throw new BadRequestException('Missing approval user context');
    return this.payments.refund(tenantId, paymentId, dto, approvalUserId);
  }

  @Post('tenants/:tenantId/payments/:paymentId/cancel')
  @Roles(SystemRole.SUPERADMIN, TenantRole.ADMIN, TenantRole.MODERATOR)
  @UseGuards(PaymentsApprovalGuard)
  @Idempotent('payments:cancel')
  @ApiOperation({ summary: 'Cancelamento de um pagamento PENDING' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'Idempotency-Scope', required: true, description: 'Valor fixo: payments:cancel' })
  @ApiHeader({ name: 'X-Approval-Token', required: true })
  @ApiParam({ name: 'paymentId', example: 'b9a7a6d9-2a6d-4d8a-8a71-9e8f3fddf6d0' })
  async cancel(
    @TenantId() tenantId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: CancelPaymentDto,
    @Req() req: any,
  ) {
    const approvalUserId = req?.approvalUser?.id;
    if (!approvalUserId) throw new BadRequestException('Missing approval user context');
    return this.payments.cancel(tenantId, paymentId, dto, approvalUserId);
  }
}
