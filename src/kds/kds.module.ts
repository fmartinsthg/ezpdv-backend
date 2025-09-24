import { Module } from "@nestjs/common";
import { KdsController } from "./kds.controller";
import { KdsService } from "./kds.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { AuthModule } from "../auth/auth.module";
import { CashWindowPort } from "./ports/cash-window.port";
import { CashWindowNoneAdapter } from "./adapters/cash-window.none";
import { KdsBus } from "./kds.bus";

@Module({
  imports: [AuthModule, WebhooksModule],
  controllers: [KdsController],
  providers: [
    PrismaService,
    KdsService,
    KdsBus, // 👈 provê o bus de SSE
    { provide: CashWindowPort, useClass: CashWindowNoneAdapter },
  ],
  exports: [KdsService, KdsBus], // 👈 exporta o bus para outros módulos (OrdersService)
})
export class KdsModule {}
