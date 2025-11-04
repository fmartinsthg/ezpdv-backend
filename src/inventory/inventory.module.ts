import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryEventsService } from "./integration/inventory-events.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryEventsService, PrismaService],
  exports: [InventoryService, InventoryEventsService],
})
export class InventoryModule {}
