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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksService = void 0;
// src/webhooks/webhooks.service.ts
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let WebhooksService = class WebhooksService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async queueEvent(tx, params) {
        const { tenantId, type, payload, version = 1, occurredAt = new Date(), } = params;
        const evt = await tx.webhookEvent.create({
            data: { tenantId, type, payload, version, occurredAt },
            select: { id: true },
        });
        const endpoints = await tx.webhookEndpoint.findMany({
            where: { tenantId, isActive: true, events: { has: type } },
            select: { id: true },
        });
        if (endpoints.length > 0) {
            await tx.webhookDelivery.createMany({
                data: endpoints.map((ep) => ({
                    eventId: evt.id,
                    endpointId: ep.id,
                    status: "PENDING",
                    attempt: 0,
                })),
            });
        }
    }
};
exports.WebhooksService = WebhooksService;
exports.WebhooksService = WebhooksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WebhooksService);
