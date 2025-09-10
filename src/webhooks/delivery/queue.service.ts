// src/webhooks/delivery/queue.service.ts
import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { WEBHOOK_QUEUE_NAME } from '../webhooks.constants';
import { BULLMQ_REDIS } from '../redis.provider';

@Injectable()
export class DeliveryQueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(@Inject(BULLMQ_REDIS) connection: IORedis) { // ✅ conexão injetada
    this.queue = new Queue(WEBHOOK_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async enqueueDelivery(deliveryId: string, delayMs = 0) {
    const opts: JobsOptions = {
      jobId: deliveryId,              // idempotente por delivery
      delay: Math.max(0, delayMs),
    };
    await this.queue.add('deliver', { deliveryId }, opts);
  }

  async onModuleDestroy() {
    await this.queue.close();
    // ❌ NÃO encerrar a conexão aqui; ela é compartilhada pelo provider
  }
}
