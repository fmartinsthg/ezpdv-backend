import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { PaymentsApprovalGuard } from "./payments.approval.guard";

import { NullGateway } from "./gateway/null.gateway";
import { PAYMENT_GATEWAY } from "./gateway/payment-gateway.interface";

import { IdempotencyModule } from "../common/idempotency/idempotency.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, WebhooksModule, IdempotencyModule],
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
  exports: [PaymentsService],
})
export class PaymentsModule {}
