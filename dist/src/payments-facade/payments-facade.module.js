"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsFacadeModule = void 0;
const common_1 = require("@nestjs/common");
const payments_facade_controller_1 = require("./payments-facade.controller");
const payments_facade_service_1 = require("./payments-facade.service");
const payments_module_1 = require("../payments/payments.module");
const payment_intents_module_1 = require("../payment-intents/payment-intents.module");
const prisma_module_1 = require("../prisma/prisma.module");
let PaymentsFacadeModule = class PaymentsFacadeModule {
};
exports.PaymentsFacadeModule = PaymentsFacadeModule;
exports.PaymentsFacadeModule = PaymentsFacadeModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, payments_module_1.PaymentsModule, payment_intents_module_1.PaymentIntentsModule],
        controllers: [payments_facade_controller_1.PaymentsFacadeController],
        providers: [payments_facade_service_1.PaymentsFacadeService],
    })
], PaymentsFacadeModule);
