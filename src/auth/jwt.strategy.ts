// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** Tipo que seu app vai receber em req.user (unificado) */
export interface AuthUser {
  /** ID canônico do usuário (como no JWT: `sub`) */
  sub: string;
  /** Alias legado para compatibilidade com código existente */
  userId: string;

  /** Papel global na plataforma */
  systemRole: 'SUPERADMIN' | 'SUPPORT' | 'NONE' | null;
  /** Tenant do contexto (pode ser null para SUPERADMIN fora de contexto) */
  tenantId: string | null;
  /** Papel dentro do tenant atual */
  role: 'ADMIN' | 'MODERATOR' | 'USER' | null;

  /** Opcional: e-mail (se incluído no payload) */
  email?: string | null;
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
    // Garante string e preenche ambos os campos (sub e userId)
    const id = String(payload.sub);

    return {
      sub: id,
      userId: id,
      systemRole: (payload.systemRole as AuthUser['systemRole']) ?? 'NONE',
      tenantId: (payload.tenantId as string | null) ?? null,
      role: (payload.role as AuthUser['role']) ?? null,
      email: (payload.email as string | null) ?? null,
    };
  }
}
