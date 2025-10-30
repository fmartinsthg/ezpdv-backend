// src/app.module.ts
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";

import { JwtAuthGuard } from "./auth/jwt.guard";
import { RolesGuard } from "./auth/roles.guard";

import {
  TenantContextGuard,
  TenantRouteValidationInterceptor,
} from "./common/tenant";

import { EtagInterceptor } from "./common/http/etag.interceptor";
import { HttpTenantMiddleware } from "./common/middleware/http-tenant.middleware";

import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CategoryModule } from "./category/category.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { IdempotencyModule } from "./common/idempotency/idempotency.module";
import { PaymentsModule } from "./payments/payments.module";
import { PaymentIntentsModule } from "./payment-intents/payment-intents.module";
import { PlatformModule } from "./platform/platform.module";
import { KdsModule } from "./kds/kds.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { CashModule } from "./cash/cash.module";

// ⬇️ NOVO: módulo de Inventário (rotas /tenants/:tenantId/inventory/..., recipes, movements)
import { InventoryModule } from "./inventory/inventory.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,

    // Auth / Core
    AuthModule,
    UsersModule,
    IdempotencyModule,

    // Domínio
    CategoryModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    PaymentIntentsModule,
    KdsModule,
    CashModule,
    WebhooksModule,
    PlatformModule,

    // ⬇️ Novo domínio: Inventário (não interfere em rotas top-level)
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [
    // Guards globais
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantContextGuard },

    // Interceptors globais
    { provide: APP_INTERCEPTOR, useClass: TenantRouteValidationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: EtagInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ✅ Escopa o middleware APENAS em endpoints top-level que exigem X-Tenant-Id no header
    // (Rotas com /tenants/:tenantId/... NÃO precisam desse middleware)
    consumer.apply(HttpTenantMiddleware).forRoutes(
      { path: "categories", method: RequestMethod.ALL },
      { path: "products", method: RequestMethod.ALL }
      // adicione aqui outros endpoints TOP-LEVEL (sem /tenants/:tenantId) conforme necessário
    );
  }
}
