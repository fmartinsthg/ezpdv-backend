// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module'; // Para injetar PrismaService
import { ProductsModule } from '../products/products.module'; // Se for necessário buscar info de produtos

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  imports: [PrismaModule, ProductsModule],
  exports: [OrdersService],
})
export class OrdersModule {}
