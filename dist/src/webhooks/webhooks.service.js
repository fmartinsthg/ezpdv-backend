"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksService = void 0;
// src/webhooks/webhooks.service.ts
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto = __importStar(require("crypto"));
const client_1 = require("@prisma/client");
const queue_service_1 = require("./delivery/queue.service");
function maskSecret(s) {
    if (!s)
        return '';
    const tail = s.slice(-4);
    return `${'*'.repeat(Math.max(0, s.length - 4))}${tail}`;
}
let WebhooksService = class WebhooksService {
    constructor(prisma, queue) {
        this.prisma = prisma;
        this.queue = queue;
    }
    /* ---------- Endpoints ---------- */
    async createEndpoint(tenantId, data) {
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
    async listEndpoints(tenantId) {
        const endpoints = await this.prisma.webhookEndpoint.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
        return endpoints.map((e) => ({ ...e, secret: maskSecret(e.secret) }));
    }
    async patchEndpoint(tenantId, id, dto, ifMatch) {
        const ep = await this.prisma.webhookEndpoint.findFirst({ where: { id, tenantId } });
        if (!ep)
            throw new common_1.NotFoundException('Endpoint não encontrado');
        if (ifMatch !== undefined) {
            const v = parseInt(String(ifMatch).replace(/W\/"?|"/g, ''), 10);
            if (Number.isFinite(v) && v !== ep.version) {
                throw new common_1.ConflictException({ code: 'ETAG_MISMATCH', expected: ep.version, got: v });
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
    async rotateSecret(tenantId, id, ifMatch) {
        const ep = await this.prisma.webhookEndpoint.findFirst({ where: { id, tenantId } });
        if (!ep)
            throw new common_1.NotFoundException('Endpoint não encontrado');
        if (ifMatch !== undefined) {
            const v = parseInt(String(ifMatch).replace(/W\/"?|"/g, ''), 10);
            if (Number.isFinite(v) && v !== ep.version) {
                throw new common_1.ConflictException({ code: 'ETAG_MISMATCH', expected: ep.version, got: v });
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
    async queueEvent(tenantId, type, payload, opts) {
        const endpoints = await this.prisma.webhookEndpoint.findMany({
            where: { tenantId, isActive: true, events: { has: type } },
            select: { id: true },
        });
        if (endpoints.length === 0)
            return { ok: true, deliveries: 0 };
        const event = await this.prisma.webhookEvent.create({
            data: { tenantId, type, payload, occurredAt: new Date(), version: 1 },
            select: { id: true },
        });
        const ids = [];
        const data = endpoints.map((ep) => {
            const id = crypto.randomUUID();
            ids.push(id);
            return {
                id,
                tenantId,
                eventId: event.id,
                endpointId: ep.id,
                status: client_1.WebhookDeliveryStatus.PENDING,
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
    async listDeliveries(tenantId, query) {
        const page = Number(query.page || 1);
        const take = Math.min(Number(query.pageSize || 20), 100);
        const where = { tenantId };
        if (query.status)
            where.status = query.status;
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
    async replay(tenantId, dto) {
        const endpoints = await this.prisma.webhookEndpoint.findMany({
            where: { tenantId, isActive: true, events: { has: dto.type } },
            select: { id: true },
        });
        if (endpoints.length === 0)
            return { created: 0 };
        let events = [];
        if (dto.eventIds?.length) {
            events = await this.prisma.webhookEvent.findMany({
                where: { tenantId, id: { in: dto.eventIds } },
                select: { id: true },
            });
        }
        else {
            const from = dto.from ? new Date(dto.from) : new Date(Date.now() - 3_600_000);
            const to = dto.to ? new Date(dto.to) : new Date();
            events = await this.prisma.webhookEvent.findMany({
                where: { tenantId, type: dto.type, occurredAt: { gte: from, lte: to } },
                select: { id: true },
            });
        }
        if (events.length === 0)
            return { created: 0 };
        const ids = [];
        const data = events.flatMap((ev) => endpoints.map((ep) => {
            const id = crypto.randomUUID();
            ids.push(id);
            return {
                id,
                tenantId,
                eventId: ev.id,
                endpointId: ep.id,
                status: client_1.WebhookDeliveryStatus.PENDING,
                attemptCount: 0,
                createdAt: new Date(),
            };
        }));
        await this.prisma.webhookDelivery.createMany({ data });
        await Promise.all(ids.map((id) => this.queue.enqueueDelivery(id)));
        return { created: ids.length };
    }
};
exports.WebhooksService = WebhooksService;
exports.WebhooksService = WebhooksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        queue_service_1.DeliveryQueueService])
], WebhooksService);
