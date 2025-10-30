"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
// src/app.module.ts
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const jwt_guard_1 = require("./auth/jwt.guard");
const roles_guard_1 = require("./auth/roles.guard");
const tenant_1 = require("./common/tenant");
const etag_interceptor_1 = require("./common/http/etag.interceptor");
const http_tenant_middleware_1 = require("./common/middleware/http-tenant.middleware");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const category_module_1 = require("./category/category.module");
const products_module_1 = require("./products/products.module");
const orders_module_1 = require("./orders/orders.module");
const idempotency_module_1 = require("./common/idempotency/idempotency.module");
const payments_module_1 = require("./payments/payments.module");
const payment_intents_module_1 = require("./payment-intents/payment-intents.module");
const platform_module_1 = require("./platform/platform.module");
const kds_module_1 = require("./kds/kds.module");
const webhooks_module_1 = require("./webhooks/webhooks.module");
const cash_module_1 = require("./cash/cash.module");
// ⬇️ NOVO: módulo de Inventário (rotas /tenants/:tenantId/inventory/..., recipes, movements)
const inventory_module_1 = require("./inventory/inventory.module");
let AppModule = class AppModule {
    configure(consumer) {
        // ✅ Escopa o middleware APENAS em endpoints top-level que exigem X-Tenant-Id no header
        // (Rotas com /tenants/:tenantId/... NÃO precisam desse middleware)
        consumer.apply(http_tenant_middleware_1.HttpTenantMiddleware).forRoutes({ path: "categories", method: common_1.RequestMethod.ALL }, { path: "products", method: common_1.RequestMethod.ALL }
        // adicione aqui outros endpoints TOP-LEVEL (sem /tenants/:tenantId) conforme necessário
        );
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            // Auth / Core
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            idempotency_module_1.IdempotencyModule,
            // Domínio
            category_module_1.CategoryModule,
            products_module_1.ProductsModule,
            orders_module_1.OrdersModule,
            payments_module_1.PaymentsModule,
            payment_intents_module_1.PaymentIntentsModule,
            kds_module_1.KdsModule,
            cash_module_1.CashModule,
            webhooks_module_1.WebhooksModule,
            platform_module_1.PlatformModule,
            // ⬇️ Novo domínio: Inventário (não interfere em rotas top-level)
            inventory_module_1.InventoryModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            // Guards globais
            { provide: core_1.APP_GUARD, useClass: jwt_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: roles_guard_1.RolesGuard },
            { provide: core_1.APP_GUARD, useClass: tenant_1.TenantContextGuard },
            // Interceptors globais
            { provide: core_1.APP_INTERCEPTOR, useClass: tenant_1.TenantRouteValidationInterceptor },
            { provide: core_1.APP_INTERCEPTOR, useClass: etag_interceptor_1.EtagInterceptor },
        ],
    })
], AppModule);
