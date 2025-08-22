import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TENANT_HEADER, TenantErrors } from './tenant.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_TENANT_KEY } from './skip-tenant.decorator';

type AuthUserLike = {
  sub?: string;
  role?: string | null;        // papel no tenant (ADMIN/MODERATOR/USER)
  systemRole?: string | null;  // papel de plataforma (SUPERADMIN)
  tenantId?: string | null;
};

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1) Rotas públicas não exigem JWT/tenant
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2) Rotas de PLATAFORMA (ex.: /tenants) não exigem tenant
    const skipTenant = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipTenant) return true;

    const req = context.switchToHttp().getRequest();
    let user = (req.user || {}) as AuthUserLike;

    // 3) Fallback: se req.user não vier populado pelo JwtAuthGuard, verifique o JWT manualmente
    if (!user?.sub) {
      const authHeader = (req.headers['authorization'] || '') as string;
      const hasBearer = authHeader.startsWith('Bearer ');
      if (!hasBearer) {
        throw new ForbiddenException('Usuário não autenticado.');
      }
      const token = authHeader.slice('Bearer '.length).trim();
      try {
        // Verifica assinatura e expiração (mais seguro que decode)
        const secret =
          this.config.get<string>('JWT_SECRET') ||
          this.config.get<string>('AUTH_JWT_SECRET'); // caso seu projeto use outra chave
        const payload = await this.jwtService.verifyAsync(token, {
          secret,
        });
        user = payload as AuthUserLike;
        req.user = user; // popula o request para os próximos guards/controllers
      } catch {
        throw new ForbiddenException('Usuário não autenticado.');
      }
    }

    // 4) Papel efetivo: plataforma > tenant
    const effectiveRole = String(user.systemRole ?? user.role ?? '')
      .toUpperCase()
      .trim();

    // 5) SUPERADMIN → exige header X-Tenant-Id em rotas multi-tenant
    if (effectiveRole === 'SUPERADMIN') {
      const headerValue =
        (req.headers[TENANT_HEADER] as string) ||
        (req.headers[String(TENANT_HEADER).toUpperCase()] as string);
      if (!headerValue) {
        throw new BadRequestException(
          TenantErrors.MISSING_HEADER_FOR_SUPERADMIN,
        );
      }
      req.tenantId = headerValue;
      return true;
    }

    // 6) Demais papéis → tenant do token
    if (!user.tenantId) {
      throw new ForbiddenException(TenantErrors.MISSING_TENANT_IN_TOKEN);
    }

    req.tenantId = user.tenantId;
    return true;
  }
}
