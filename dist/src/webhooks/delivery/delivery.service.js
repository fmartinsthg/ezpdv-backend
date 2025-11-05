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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WebhookDeliveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookDeliveryService = void 0;
// src/webhooks/delivery/delivery.service.ts
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const TIMEOUT_MS = 10_000;
// Backoff: 1m, 5m, 15m, 1h, 4h, 12h, 24h
const BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720, 1440];
let WebhookDeliveryService = WebhookDeliveryService_1 = class WebhookDeliveryService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(WebhookDeliveryService_1.name);
    }
    computeNextRetryAt(nextAttemptCount) {
        const idx = Math.min(nextAttemptCount - 1, BACKOFF_MINUTES.length - 1);
        return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000);
    }
    sign(secret, body) {
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
    async deliver(deliveryId) {
        const now = new Date();
        // Claim (evita concorrência: só pega se ainda estiver pendente e pronto pra enviar)
        const claimed = await this.prisma.webhookDelivery.updateMany({
            where: {
                id: deliveryId,
                status: client_1.WebhookDeliveryStatus.PENDING,
                OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
            },
            data: { status: client_1.WebhookDeliveryStatus.SENDING },
        });
        if (claimed.count === 0)
            return;
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
        if (!d || !d.endpoint || !d.event)
            return;
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
            const resp = await axios_1.default.post(d.endpoint.url, body, {
                headers,
                timeout: TIMEOUT_MS,
                validateStatus: () => true,
            });
            const elapsed = Date.now() - started;
            if (resp.status >= 200 && resp.status < 300) {
                await this.prisma.webhookDelivery.update({
                    where: { id: d.id },
                    data: {
                        status: client_1.WebhookDeliveryStatus.SENT,
                        responseCode: resp.status,
                        responseTimeMs: elapsed,
                        deliveredAt: new Date(),
                        lastError: null,
                        nextRetryAt: null,
                        attemptCount: { increment: 1 },
                    },
                });
            }
            else {
                const nextAttemptCount = (d.attemptCount ?? 0) + 1;
                await this.prisma.webhookDelivery.update({
                    where: { id: d.id },
                    data: {
                        status: client_1.WebhookDeliveryStatus.PENDING,
                        responseCode: resp.status,
                        responseTimeMs: elapsed,
                        lastError: `HTTP_${resp.status}`,
                        nextRetryAt: this.computeNextRetryAt(nextAttemptCount),
                        attemptCount: { increment: 1 },
                    },
                });
            }
        }
        catch (err) {
            const elapsed = Date.now() - started;
            const nextAttemptCount = (d.attemptCount ?? 0) + 1;
            await this.prisma.webhookDelivery.update({
                where: { id: d.id },
                data: {
                    status: client_1.WebhookDeliveryStatus.PENDING,
                    responseCode: null,
                    responseTimeMs: elapsed,
                    lastError: String(err?.message ?? err ?? 'NETWORK_ERROR').slice(0, 300),
                    nextRetryAt: this.computeNextRetryAt(nextAttemptCount),
                    attemptCount: { increment: 1 },
                },
            });
        }
    }
};
exports.WebhookDeliveryService = WebhookDeliveryService;
exports.WebhookDeliveryService = WebhookDeliveryService = WebhookDeliveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WebhookDeliveryService);
