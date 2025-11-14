import { Module } from "@nestjs/common";
import { PaymentIntentsController } from "./payment-intents.controller";
import { PaymentIntentsService } from "./payment-intents.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [PaymentIntentsController],
  providers: [PaymentIntentsService],
  exports: [PaymentIntentsService],
})
export class PaymentIntentsModule {}
