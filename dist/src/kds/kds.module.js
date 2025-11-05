"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KdsModule = void 0;
const common_1 = require("@nestjs/common");
const kds_controller_1 = require("./kds.controller");
const kds_service_1 = require("./kds.service");
const prisma_service_1 = require("../prisma/prisma.service");
const webhooks_module_1 = require("../webhooks/webhooks.module");
const auth_module_1 = require("../auth/auth.module");
const cash_window_port_1 = require("./ports/cash-window.port");
const cash_window_none_1 = require("./adapters/cash-window.none");
const kds_bus_1 = require("./kds.bus");
let KdsModule = class KdsModule {
};
exports.KdsModule = KdsModule;
exports.KdsModule = KdsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, webhooks_module_1.WebhooksModule],
        controllers: [kds_controller_1.KdsController],
        providers: [
            prisma_service_1.PrismaService,
            kds_service_1.KdsService,
            kds_bus_1.KdsBus, // 👈 provê o bus de SSE
            { provide: cash_window_port_1.CashWindowPort, useClass: cash_window_none_1.CashWindowNoneAdapter },
        ],
        exports: [kds_service_1.KdsService, kds_bus_1.KdsBus], // 👈 exporta o bus para outros módulos (OrdersService)
    })
], KdsModule);
