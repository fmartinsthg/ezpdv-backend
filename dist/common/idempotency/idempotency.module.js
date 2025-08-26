"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyModule = void 0;
const common_1 = require("@nestjs/common");
const idempotency_service_1 = require("./idempotency.service");
const idempotency_interceptor_1 = require("./idempotency.interceptor");
const prisma_module_1 = require("../../prisma/prisma.module");
let IdempotencyModule = class IdempotencyModule {
};
exports.IdempotencyModule = IdempotencyModule;
exports.IdempotencyModule = IdempotencyModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        providers: [idempotency_service_1.IdempotencyService, idempotency_interceptor_1.IdempotencyInterceptor],
        exports: [idempotency_service_1.IdempotencyService, idempotency_interceptor_1.IdempotencyInterceptor],
    })
], IdempotencyModule);
