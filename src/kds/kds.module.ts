import { Module } from "@nestjs/common";
import { KdsController } from "./kds.controller";
import { KdsService } from "./kds.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { AuthModule } from "../auth/auth.module";
import { CashWindowPort } from "./ports/cash-window.port";
import { CashWindowNoneAdapter } from "./adapters/cash-window.none";

@Module({
  imports: [AuthModule, WebhooksModule],
  controllers: [KdsController],
  providers: [
    PrismaService,
    KdsService,
    // KdsGateway,
    { provide: CashWindowPort, useClass: CashWindowNoneAdapter },
  ],
  exports: [KdsService],
})
export class KdsModule {}
