// src/webhooks/delivery/delivery.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookDeliveryStatus } from '@prisma/client';

const TIMEOUT_MS = 10_000;
// Backoff: 1m, 5m, 15m, 1h, 4h, 12h, 24h
const BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1440];

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private computeNextRetryAt(nextAttemptCount: number): Date {
    const idx = Math.min(nextAttemptCount - 1, BACKOFF_MINUTES.length - 1);
    return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000);
  }

  private sign(secret: string, body: string): string {
    const h = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return `sha256=${h}`;
  }

  /**
   * Entrega uma delivery pelo ID:
   * - faz "claim" alterando para SENDING pra evitar concorrência
   * - busca endpoint + evento (payload)
   * - POST com assinatura HMAC
   * - se 2xx => SENT; senão => PENDING com nextRetryAt e attemptCount++
   */
  async deliver(deliveryId: string) {
    const now = new Date();

    // Claim (evita concorrência: só pega se ainda estiver pendente e pronto pra enviar)
    const claimed = await this.prisma.webhookDelivery.updateMany({
      where: {
        id: deliveryId,
        status: WebhookDeliveryStatus.PENDING,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      data: { status: WebhookDeliveryStatus.SENDING },
    });
    if (claimed.count === 0) return;

    const d = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        attemptCount: true,
        endpoint: { select: { url: true, secret: true } },
        event: {
          select: {
            id: true,
            tenantId: true,
            type: true,
            payload: true,
            occurredAt: true,
            version: true,
          },
        },
      },
    });
    if (!d || !d.endpoint || !d.event) return;

    // Corpo que será assinado e enviado
    const body = JSON.stringify({
      id: d.event.id,
      tenantId: d.event.tenantId,
      type: d.event.type,
      payload: d.event.payload,
      occurredAt: d.event.occurredAt,
      version: d.event.version,
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Id': d.id,
      'X-Webhook-Event': d.event.type,
      'X-Webhook-Timestamp': Date.now().toString(),
      'X-Webhook-Signature': this.sign(d.endpoint.secret, body),
      'Idempotency-Key': d.id,
    };

    const started = Date.now();
    try {
      const resp = await axios.post(d.endpoint.url, body, {
        headers,
        timeout: TIMEOUT_MS,
        validateStatus: () => true,
      });
      const elapsed = Date.now() - started;

      if (resp.status >= 200 && resp.status < 300) {
        await this.prisma.webhookDelivery.update({
          where: { id: d.id },
          data: {
            status: WebhookDeliveryStatus.SENT,
            responseCode: resp.status,
            responseTimeMs: elapsed,
            deliveredAt: new Date(),
            lastError: null,
            nextRetryAt: null,
            attemptCount: { increment: 1 },
          },
        });
      } else {
        const nextAttemptCount = (d.attemptCount ?? 0) + 1;
        await this.prisma.webhookDelivery.update({
          where: { id: d.id },
          data: {
            status: WebhookDeliveryStatus.PENDING,
            responseCode: resp.status,
            responseTimeMs: elapsed,
            lastError: `HTTP_${resp.status}`,
            nextRetryAt: this.computeNextRetryAt(nextAttemptCount),
            attemptCount: { increment: 1 },
          },
        });
      }
    } catch (err: any) {
      const elapsed = Date.now() - started;
      const nextAttemptCount = (d.attemptCount ?? 0) + 1;
      await this.prisma.webhookDelivery.update({
        where: { id: d.id },
        data: {
          status: WebhookDeliveryStatus.PENDING,
          responseCode: null,
          responseTimeMs: elapsed,
          lastError: String(err?.message ?? err ?? 'NETWORK_ERROR').slice(0, 300),
          nextRetryAt: this.computeNextRetryAt(nextAttemptCount),
          attemptCount: { increment: 1 },
        },
      });
    }
  }
}
