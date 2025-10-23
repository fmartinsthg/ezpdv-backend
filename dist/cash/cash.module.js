"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashModule = void 0;
const common_1 = require("@nestjs/common");
const cash_controller_1 = require("./cash.controller");
const cash_service_1 = require("./cash.service");
const prisma_service_1 = require("../prisma/prisma.service");
// ✅ Em vez de injetar WebhooksService direto, importe o módulo dele
const webhooks_module_1 = require("../webhooks/webhooks.module");
// ✅ Importa AuthModule para disponibilizar JwtService e Guards no contexto do CashModule
const auth_module_1 = require("../auth/auth.module");
let CashModule = class CashModule {
};
exports.CashModule = CashModule;
exports.CashModule = CashModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule, // -> entrega JwtService e Guards
            webhooks_module_1.WebhooksModule, // -> entrega WebhooksService (se o CashService/Controller precisar)
        ],
        controllers: [cash_controller_1.CashController],
        providers: [cash_service_1.CashService, prisma_service_1.PrismaService],
        exports: [cash_service_1.CashService],
    })
], CashModule);
