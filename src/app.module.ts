// src/app.module.ts
import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EtagInterceptor } from "./common/http/etag.interceptor";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { JwtAuthGuard } from "./auth/jwt.guard";
import { RolesGuard } from "./auth/roles.guard";
import {
  TenantContextGuard,
  TenantRouteValidationInterceptor,
} from "./common/tenant";
import { UsersModule } from "./users/users.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CategoryModule } from "./category/category.module";
import { PlatformModule } from "./platform/platform.module";
import { IdempotencyModule } from "./common/idempotency/idempotency.module";
import { PaymentsModule } from "./payments/payments.module";
import { PaymentIntentsModule } from "./payment-intents/payment-intents.module";
import { KdsModule } from "./kds/kds.module";
import { WebhooksModule } from "./webhooks/webhooks.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    AuthModule,
    CategoryModule,
    PlatformModule,
    IdempotencyModule,
    PaymentsModule,
    PaymentIntentsModule,
    WebhooksModule,
    KdsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantContextGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantRouteValidationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: EtagInterceptor },
  ],
})
export class AppModule {}
