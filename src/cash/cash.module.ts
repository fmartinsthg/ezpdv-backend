import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { PrismaService } from '../prisma/prisma.service';

// ✅ Em vez de injetar WebhooksService direto, importe o módulo dele
import { WebhooksModule } from '../webhooks/webhooks.module';

// ✅ Importa AuthModule para disponibilizar JwtService e Guards no contexto do CashModule
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,     // -> entrega JwtService e Guards
    WebhooksModule, // -> entrega WebhooksService (se o CashService/Controller precisar)
  ],
  controllers: [CashController],
  providers: [CashService, PrismaService],
  exports: [CashService],
})
export class CashModule {}
