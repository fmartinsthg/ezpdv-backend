import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryEventsService } from "./integration/inventory-events.service";

// ✅ Alinha com Cash: importa AuthModule para JwtService/Guards no contexto
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    AuthModule, // -> entrega JwtService e demais deps de guards
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryEventsService, PrismaService],
  exports: [InventoryService, InventoryEventsService],
})
export class InventoryModule {}
