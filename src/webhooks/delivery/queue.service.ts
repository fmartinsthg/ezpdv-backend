import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

export const WEBHOOK_QUEUE_NAME = 'webhook-delivery';

@Injectable()
export class DeliveryQueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly queue: Queue;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.connection = new IORedis(url);
    this.queue = new Queue(WEBHOOK_QUEUE_NAME, { connection: this.connection });
  }

  async enqueueDelivery(deliveryId: string, delayMs = 0) {
    const opts: JobsOptions = {
      jobId: deliveryId,          // idempotente por delivery
      delay: Math.max(0, delayMs),
      attempts: 1,                // retries controlados pelo banco (nextRetryAt)
      removeOnComplete: 1000,
      removeOnFail: false,
    };
    await this.queue.add('deliver', { deliveryId }, opts);
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}
