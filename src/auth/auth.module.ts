import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // Config global já está no AppModule, mas deixamos explícito aqui
    ConfigModule,
    UsersModule,

    // Passport com estratégia padrão jwt
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JwtModule assíncrono para pegar secret das envs
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ??
          config.get<string>('AUTH_JWT_SECRET') ??
          'ezpdv-secret', // fallback de dev
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // ⬇️ Exporte JwtModule e PassportModule para os APP_GUARDs enxergarem JwtService
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
