import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Module({
  imports: [PrismaModule],
  providers: [
    IdempotencyService,
    // Registra globalmente; só atua em rotas marcadas com @Idempotent(...)
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
  // Exporta apenas o service (o interceptor já está global)
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
