import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { PrismaService } from "../prisma/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { KdsModule } from "../kds/kds.module";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [AuthModule, WebhooksModule, KdsModule, InventoryModule],
  controllers: [OrdersController],
  providers: [PrismaService, OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
