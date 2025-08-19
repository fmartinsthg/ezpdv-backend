// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** Tipo que seu app vai receber em req.user */
export interface AuthUser {
  userId: string;
  systemRole: 'SUPERADMIN' | 'SUPPORT' | 'NONE';
  tenantId: string | null;
  role: 'ADMIN' | 'MODERATOR' | 'USER' | null; // papel dentro do tenant
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'ezpdv-secret',
    });
  }

  async validate(payload: any): Promise<AuthUser> {
    return {
      userId: payload.sub,
      systemRole: payload.systemRole ?? 'NONE',
      tenantId: payload.tenantId ?? null,
      role: payload.role ?? null,
    };
  }
}