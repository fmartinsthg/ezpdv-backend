import { Module } from '@nestjs/common';
import { DeliveryQueueService } from './delivery-queue.service';

@Module({
  providers: [DeliveryQueueService],
  exports: [DeliveryQueueService],
})
export class DeliveryQueueModule {}
