import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { AuthController } from "./auth.controller";
import { UsersModule } from "../users/users.module";

// ✅ Importe e exporte os guards aqui para ficarem disponíveis aos módulos que importarem o AuthModule
import { JwtAuthGuard } from "./jwt.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { TenantContextGuard } from "../common/tenant/tenant-context.guard";

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>("JWT_SECRET") ??
          config.get<string>("AUTH_JWT_SECRET") ??
          "ezpdv-secret", // fallback de dev
        signOptions: { expiresIn: "1d" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // ✅ disponibiliza os guards como providers
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
  ],
  // ✅ exporta tudo que os outros módulos precisam
  exports: [
    AuthService,
    JwtModule, // -> entrega JwtService
    PassportModule,
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
  ],
})
export class AuthModule {}
