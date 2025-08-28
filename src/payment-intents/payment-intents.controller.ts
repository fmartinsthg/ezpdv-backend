import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentIntentsService } from './payment-intents.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SystemRole, TenantRole } from '@prisma/client';
import { TenantId } from '../common/tenant/tenant.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { CreatePaymentIntentDto } from './dto/create-intent.dto';
import { Idempotent } from '../common/idempotency/idempotency.decorator';

@ApiTags('PaymentIntents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PaymentIntentsController {
  constructor(private readonly intents: PaymentIntentsService) {}

  @Post('tenants/:tenantId/orders/:orderId/payment-intents')
  @Roles(SystemRole.SUPERADMIN, TenantRole.ADMIN, TenantRole.MODERATOR, TenantRole.USER)
  @Idempotent('payments:intent:create')
  @ApiOperation({ summary: 'Cria (ou retorna) um PaymentIntent OPEN para a order CLOSED' })
  @ApiParam({ name: 'tenantId', example: '...' })
  @ApiParam({ name: 'orderId', example: '...' })
  @ApiResponse({ status: 201 })
  async createOrGet(
    @TenantId() tenantId: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    const userId = (user as any)?.id ?? (user as any)?.sub;
    return this.intents.createOrGet(tenantId, orderId, userId, dto);
  }

  @Get('tenants/:tenantId/payment-intents/:intentId')
  @Roles(SystemRole.SUPERADMIN, TenantRole.ADMIN, TenantRole.MODERATOR, TenantRole.USER)
  @ApiOperation({ summary: 'Consulta um PaymentIntent por ID' })
  async getById(
    @TenantId() tenantId: string,
    @Param('intentId', new ParseUUIDPipe()) intentId: string,
  ) {
    return this.intents.getById(tenantId, intentId);
  }
}
