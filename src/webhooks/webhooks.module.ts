import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

import { WebhooksService } from "./webhooks.service";
import { WebhookDeliveryService } from "./delivery/delivery.service";
import { DeliveryQueueService } from "./delivery/queue.service";
import { BullmqProcessor } from "./delivery/bullmq.processor";
import { WebhooksController } from "./webhooks.controller";

@Module({
  imports: [],
  controllers: [WebhooksController],
  providers: [
    PrismaService,
    WebhooksService,
    WebhookDeliveryService,
    DeliveryQueueService,
    BullmqProcessor, // inicializa o worker
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
