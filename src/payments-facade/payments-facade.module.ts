import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsModule } from "../payments/payments.module";
import { PaymentIntentsModule } from "../payment-intents/payment-intents.module";

import { PaymentsFacadeService } from "./payments-facade.service";
import { PaymentsFacadeController } from "./payments-facade.controller";

@Module({
  imports: [PrismaModule, PaymentsModule, PaymentIntentsModule],
  controllers: [PaymentsFacadeController],
  providers: [PaymentsFacadeService],
  exports: [PaymentsFacadeService],
})
export class PaymentsFacadeModule {}
