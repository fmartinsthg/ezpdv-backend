"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryQueueService = void 0;
// src/webhooks/delivery/queue.service.ts
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const webhooks_constants_1 = require("../webhooks.constants");
const redis_provider_1 = require("../redis.provider");
let DeliveryQueueService = class DeliveryQueueService {
    constructor(connection) {
        this.queue = new bullmq_1.Queue(webhooks_constants_1.WEBHOOK_QUEUE_NAME, {
            connection,
            defaultJobOptions: {
                // retries são controlados pelo banco (nextRetryAt)
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: false,
            },
        });
    }
    async enqueueDelivery(deliveryId, delayMs = 0) {
        const opts = {
            jobId: deliveryId, // idempotente por delivery
            delay: Math.max(0, delayMs),
        };
        await this.queue.add('deliver', { deliveryId }, opts);
    }
    async onModuleDestroy() {
        await this.queue.close();
        // ❌ NÃO encerrar a conexão aqui; ela é compartilhada pelo provider
    }
};
exports.DeliveryQueueService = DeliveryQueueService;
exports.DeliveryQueueService = DeliveryQueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_provider_1.BULLMQ_REDIS)),
    __metadata("design:paramtypes", [ioredis_1.default])
], DeliveryQueueService);
