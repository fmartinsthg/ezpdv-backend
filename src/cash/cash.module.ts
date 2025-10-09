import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { PrismaService } from '../prisma/prisma.service';
// IMPORTANTE: ajuste o import conforme sua infra de webhooks:
import { WebhooksService } from '../webhooks/webhooks.service'; // BullMQ/Redis já existente

@Module({
  controllers: [CashController],
  providers: [CashService, PrismaService, WebhooksService],
  exports: [CashService],
})
export class CashModule {}
