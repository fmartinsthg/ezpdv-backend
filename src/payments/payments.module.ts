import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaymentsApprovalGuard } from "./payments.approval.guard";

import { NullGateway } from "./gateway/null.gateway";
import { PAYMENT_GATEWAY } from "./gateway/payment-gateway.interface";

import { PrismaModule } from "../prisma/prisma.module";
import { IdempotencyModule } from "../common/idempotency/idempotency.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { AuthModule } from "../auth/auth.module";
import { CashModule } from "../cash/cash.module";

import { PaymentIntentsModule } from "../payment-intents/payment-intents.module";

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    WebhooksModule,
    IdempotencyModule,
    CashModule,
    PaymentIntentsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsApprovalGuard,
    {
      provide: PAYMENT_GATEWAY,
      useClass: NullGateway,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
