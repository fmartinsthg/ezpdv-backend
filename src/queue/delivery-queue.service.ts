import { Injectable } from '@nestjs/common';

@Injectable()
export class DeliveryQueueService {
  // implemente aqui sua fila (Bull, in-memory, etc.)
  async enqueueDelivery(payload: any) {
    // ...
  }
}
