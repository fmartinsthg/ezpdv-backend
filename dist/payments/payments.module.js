"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const payments_controller_1 = require("./payments.controller");
const payments_service_1 = require("./payments.service");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const payments_approval_guard_1 = require("./payments.approval.guard");
const null_gateway_1 = require("./gateway/null.gateway");
const payment_gateway_interface_1 = require("./gateway/payment-gateway.interface");
const idempotency_module_1 = require("../common/idempotency/idempotency.module");
const webhooks_module_1 = require("../webhooks/webhooks.module");
const auth_module_1 = require("../auth/auth.module");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, webhooks_module_1.WebhooksModule, idempotency_module_1.IdempotencyModule],
        controllers: [payments_controller_1.PaymentsController],
        providers: [
            prisma_service_1.PrismaService,
            payments_service_1.PaymentsService,
            jwt_1.JwtService,
            payments_approval_guard_1.PaymentsApprovalGuard,
            {
                provide: payment_gateway_interface_1.PAYMENT_GATEWAY,
                useClass: null_gateway_1.NullGateway,
            },
        ],
        exports: [payments_service_1.PaymentsService],
    })
], PaymentsModule);
