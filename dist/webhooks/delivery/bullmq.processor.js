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
var BullmqProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullmqProcessor = void 0;
// src/webhooks/delivery/bullmq.processor.ts
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma_service_1 = require("../../prisma/prisma.service");
const delivery_service_1 = require("./delivery.service");
const queue_service_1 = require("./queue.service");
const webhooks_constants_1 = require("../webhooks.constants");
const client_1 = require("@prisma/client");
const redis_provider_1 = require("../redis.provider");
let BullmqProcessor = BullmqProcessor_1 = class BullmqProcessor {
    constructor(prisma, delivery, producer, connection // ✅ conexão injetada
    ) {
        this.prisma = prisma;
        this.delivery = delivery;
        this.producer = producer;
        this.connection = connection;
        this.logger = new common_1.Logger(BullmqProcessor_1.name);
        this.worker = new bullmq_1.Worker(webhooks_constants_1.WEBHOOK_QUEUE_NAME, async (job) => {
            const { deliveryId } = job.data;
            await this.delivery.deliver(deliveryId);
            // Se ainda ficou PENDING com nextRetryAt, re-agendar
            const d = await this.prisma.webhookDelivery.findUnique({
                where: { id: deliveryId },
                select: { status: true, nextRetryAt: true },
            });
            if (d?.status === client_1.WebhookDeliveryStatus.PENDING && d.nextRetryAt) {
                const delayMs = Math.max(0, d.nextRetryAt.getTime() - Date.now());
                await this.producer.enqueueDelivery(deliveryId, delayMs);
            }
        }, {
            connection: this.connection,
            concurrency: 5,
        });
        this.worker.on("failed", (job, err) => {
            this.logger.error(`Job ${job?.id} failed: ${err?.message ?? err}`);
        });
        this.worker.on("error", (err) => {
            this.logger.error(`Worker error: ${err?.message ?? err}`);
        });
    }
    async onModuleDestroy() {
        await this.worker.close();
    }
};
exports.BullmqProcessor = BullmqProcessor;
exports.BullmqProcessor = BullmqProcessor = BullmqProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(redis_provider_1.BULLMQ_REDIS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        delivery_service_1.WebhookDeliveryService,
        queue_service_1.DeliveryQueueService,
        ioredis_1.default // ✅ conexão injetada
    ])
], BullmqProcessor);
