import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PaymentsApprovalGuard } from './payments.approval.guard';

import { NullGateway } from './gateway/null.gateway';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway.interface';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';

@Module({
  imports: [IdempotencyModule],
  controllers: [PaymentsController],
  providers: [
    PrismaService,
    PaymentsService,
    JwtService,
    PaymentsApprovalGuard,
    {
      provide: PAYMENT_GATEWAY,
      useClass: NullGateway,
    },
  ],
})
export class PaymentsModule {}
