import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../prisma/prisma.service";
// ❌ REMOVIDO: import { JwtService } from "@nestjs/jwt";
import { PaymentsApprovalGuard } from "./payments.approval.guard";

import { NullGateway } from "./gateway/null.gateway";
import { PAYMENT_GATEWAY } from "./gateway/payment-gateway.interface";

import { IdempotencyModule } from "../common/idempotency/idempotency.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { AuthModule } from "../auth/auth.module";

// necessário para injetar CashService no PaymentsService
import { CashModule } from "../cash/cash.module";

@Module({
  imports: [
    AuthModule, // -> JwtService e guards vêm daqui
    WebhooksModule,
    IdempotencyModule,
    CashModule, // -> expõe CashService
  ],
  controllers: [PaymentsController],
  providers: [
    PrismaService,
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
