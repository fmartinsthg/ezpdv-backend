// src/webhooks/delivery/bullmq.processor.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookDeliveryService } from './delivery.service';
import { DeliveryQueueService } from './queue.service';
import { WEBHOOK_QUEUE_NAME } from '../webhooks.constants';
import { WebhookDeliveryStatus } from '@prisma/client';

@Injectable()
export class BullmqProcessor implements OnModuleDestroy {
  private readonly logger = new Logger(BullmqProcessor.name);
  private readonly connection: IORedis;
  private readonly worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: WebhookDeliveryService,
    private readonly producer: DeliveryQueueService,
  ) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.connection = new IORedis(url);

    this.worker = new Worker(
      WEBHOOK_QUEUE_NAME,
      async (job) => {
        const { deliveryId } = job.data as { deliveryId: string };

        await this.delivery.deliver(deliveryId);

        // Se ainda ficou PENDING com nextRetryAt, re-agendar
        const d = await this.prisma.webhookDelivery.findUnique({
          where: { id: deliveryId },
          select: { status: true, nextRetryAt: true },
        });

        if (d?.status === WebhookDeliveryStatus.PENDING && d.nextRetryAt) {
          const delayMs = Math.max(0, d.nextRetryAt.getTime() - Date.now());
          await this.producer.enqueueDelivery(deliveryId, delayMs);
        }
      },
      { connection: this.connection, concurrency: 5 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err?.message ?? err}`);
    });

    this.worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err?.message ?? err}`);
    });
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.connection.quit();
  }
}
