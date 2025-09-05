// src/webhooks/webhooks.service.ts
import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { WebhookDeliveryStatus } from '@prisma/client';
import { DeliveryQueueService } from './delivery/queue.service';

function maskSecret(s: string) {
  if (!s) return '';
  const tail = s.slice(-4);
  return `${'*'.repeat(Math.max(0, s.length - 4))}${tail}`;
}

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: DeliveryQueueService,
  ) {}

  /* ---------- Endpoints ---------- */

  async createEndpoint(tenantId: string, data: { url: string; events: string[]; secret?: string }) {
    const secret = data.secret ?? crypto.randomBytes(32).toString('hex');
    return this.prisma.webhookEndpoint.create({
      data: {
        tenantId,
        url: data.url,
        events: data.events,
        secret,
      },
    });
  }

  async listEndpoints(tenantId: string) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return endpoints.map((e) => ({ ...e, secret: maskSecret(e.secret) }));
  }

  async patchEndpoint(tenantId: string, id: string, dto: { url?: string; events?: string[]; isActive?: boolean }, ifMatch?: string) {
    const ep = await this.prisma.webhookEndpoint.findFirst({ where: { id, tenantId } });
    if (!ep) throw new NotFoundException('Endpoint não encontrado');

    if (ifMatch !== undefined) {
      const v = parseInt(String(ifMatch).replace(/W\/"?|"/g, ''), 10);
      if (Number.isFinite(v) && v !== ep.version) {
        throw new ConflictException({ code: 'ETAG_MISMATCH', expected: ep.version, got: v });
      }
    }

    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        url: dto.url ?? ep.url,
        events: dto.events ?? ep.events,
        isActive: dto.isActive ?? ep.isActive,
        version: { increment: 1 },
      },
    });

    return { ...updated, secret: maskSecret(updated.secret) };
  }

  async rotateSecret(tenantId: string, id: string, ifMatch?: string) {
    const ep = await this.prisma.webhookEndpoint.findFirst({ where: { id, tenantId } });
    if (!ep) throw new NotFoundException('Endpoint não encontrado');

    if (ifMatch !== undefined) {
      const v = parseInt(String(ifMatch).replace(/W\/"?|"/g, ''), 10);
      if (Number.isFinite(v) && v !== ep.version) {
        throw new ConflictException({ code: 'ETAG_MISMATCH', expected: ep.version, got: v });
      }
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { secret, version: { increment: 1 } },
    });
    return { ...updated, secret: maskSecret(updated.secret) };
  }

  /* ---------- Enfileirar eventos ---------- */

  async queueEvent(
    tenantId: string,
    type: string,
    payload: any,
    opts?: { deliverNow?: boolean },
  ) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { tenantId, isActive: true, events: { has: type } },
      select: { id: true },
    });
    if (endpoints.length === 0) return { ok: true, deliveries: 0 };

    const event = await this.prisma.webhookEvent.create({
      data: { tenantId, type, payload, occurredAt: new Date(), version: 1 },
      select: { id: true },
    });

    const ids: string[] = [];
    const data = endpoints.map((ep) => {
      const id = crypto.randomUUID();
      ids.push(id);
      return {
        id,
        tenantId,
        eventId: event.id,
        endpointId: ep.id,
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
        createdAt: new Date(),
        // Se quiser disparar imediatamente pelo worker, marque nextRetryAt = agora
        nextRetryAt: opts?.deliverNow ? new Date() : null,
      };
    });

    await this.prisma.webhookDelivery.createMany({ data });

    await Promise.all(ids.map((id) => this.queue.enqueueDelivery(id)));

    return { ok: true, eventId: event.id, deliveries: ids.length };
  }

  /* ---------- Auditoria ---------- */

  async listDeliveries(
    tenantId: string,
    query: { status?: WebhookDeliveryStatus | string; eventType?: string; page?: number; pageSize?: number },
  ) {
    const page = Number(query.page || 1);
    const take = Math.min(Number(query.pageSize || 20), 100);

    const where: any = { tenantId };
    if (query.status) where.status = query.status as WebhookDeliveryStatus;
    if (query.eventType) {
      where.event = { type: query.eventType };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: { endpoint: { select: { id: true, url: true } }, event: { select: { type: true } } },
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);

    return { items, total, page, pageSize: take };
  }

  /* ---------- Replay ---------- */

  async replay(
    tenantId: string,
    dto: { eventIds?: string[]; from?: string; to?: string; type: string },
  ) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { tenantId, isActive: true, events: { has: dto.type } },
      select: { id: true },
    });
    if (endpoints.length === 0) return { created: 0 };

    let events: { id: string }[] = [];
    if (dto.eventIds?.length) {
      events = await this.prisma.webhookEvent.findMany({
        where: { tenantId, id: { in: dto.eventIds } },
        select: { id: true },
      });
    } else {
      const from = dto.from ? new Date(dto.from) : new Date(Date.now() - 3_600_000);
      const to = dto.to ? new Date(dto.to) : new Date();
      events = await this.prisma.webhookEvent.findMany({
        where: { tenantId, type: dto.type, occurredAt: { gte: from, lte: to } },
        select: { id: true },
      });
    }

    if (events.length === 0) return { created: 0 };

    const ids: string[] = [];
    const data = events.flatMap((ev) =>
      endpoints.map((ep) => {
        const id = crypto.randomUUID();
        ids.push(id);
        return {
          id,
          tenantId,
          eventId: ev.id,
          endpointId: ep.id,
          status: WebhookDeliveryStatus.PENDING,
          attemptCount: 0,
          createdAt: new Date(),
        };
      }),
    );

    await this.prisma.webhookDelivery.createMany({ data });
    await Promise.all(ids.map((id) => this.queue.enqueueDelivery(id)));

    return { created: ids.length };
  }
}
