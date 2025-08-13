// src/products/products.module.ts
import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  imports: [PrismaModule], // Permite usar PrismaService via injeção
  exports: [ProductsService], // Exporta o service se outros módulos precisarem
})
export class ProductsModule {}
