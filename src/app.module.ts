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

import { IdempotencyInterceptor } from "./common/idempotency/idempotency.interceptor";

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
import { InventoryModule } from "./inventory/inventory.module";
import { PaymentsFacadeModule } from "./payments-facade/payments-facade.module";

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
    InventoryModule,
    PaymentsFacadeModule,
  ],
  controllers: [AppController],
  providers: [
    // Guards globais
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantContextGuard },

    // Interceptors globais (ordem intencional)
    { provide: APP_INTERCEPTOR, useClass: TenantRouteValidationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: EtagInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HttpTenantMiddleware)
      .forRoutes(
        { path: "categories", method: RequestMethod.ALL },
        { path: "products", method: RequestMethod.ALL }
      );
  }
}
