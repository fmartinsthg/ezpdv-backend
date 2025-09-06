"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const webhooks_service_1 = require("./webhooks.service");
const delivery_service_1 = require("./delivery/delivery.service");
const queue_service_1 = require("./delivery/queue.service");
const bullmq_processor_1 = require("./delivery/bullmq.processor");
const webhooks_controller_1 = require("./webhooks.controller");
const redis_provider_1 = require("./redis.provider");
let WebhooksModule = class WebhooksModule {
};
exports.WebhooksModule = WebhooksModule;
exports.WebhooksModule = WebhooksModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        controllers: [webhooks_controller_1.WebhooksController],
        providers: [
            prisma_service_1.PrismaService,
            webhooks_service_1.WebhooksService,
            delivery_service_1.WebhookDeliveryService,
            queue_service_1.DeliveryQueueService,
            bullmq_processor_1.BullmqProcessor,
            {
                provide: redis_provider_1.BULLMQ_REDIS,
                useFactory: () => (0, redis_provider_1.createBullMqRedis)(),
            },
        ],
        exports: [webhooks_service_1.WebhooksService],
    })
], WebhooksModule);
