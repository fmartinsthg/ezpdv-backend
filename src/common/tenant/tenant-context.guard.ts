import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { TENANT_HEADER, TenantErrors } from "./tenant.constants";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator"; // <— MESMO arquivo
import { SKIP_TENANT_KEY } from "./skip-tenant.decorator";

type AuthUserLike = {
  sub?: string;
  role?: string | null; // papel no tenant (ADMIN/MODERATOR/USER)
  systemRole?: string | null; // papel de plataforma (SUPERADMIN)
  tenantId?: string | null;
};

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // 0) Bypass defensivo por URL (funciona mesmo com prefixo /api, /v1, etc.)
    const url = String(req.originalUrl || req.url || "").toLowerCase();
    if (url.includes("/auth/login")) {
      return true;
    }

    // 1) Rotas públicas não exigem JWT/tenant
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2) Rotas que explicitamente “pulam” tenant (plataforma)
    const skipTenant = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (skipTenant) return true;

    let user = (req.user || {}) as AuthUserLike;

    // 3) Garante user no request (fallback se JwtAuthGuard ainda não populou)
    if (!user?.sub) {
      const authHeader = (req.headers["authorization"] || "") as string;
      const hasBearer = authHeader.startsWith("Bearer ");
      if (!hasBearer) {
        throw new ForbiddenException("Usuário não autenticado.");
      }
      const token = authHeader.slice("Bearer ".length).trim();
      try {
        const secret =
          this.config.get<string>("JWT_SECRET") ||
          this.config.get<string>("AUTH_JWT_SECRET");
        const payload = await this.jwtService.verifyAsync(token, { secret });
        user = payload as AuthUserLike;
        req.user = user;
      } catch {
        throw new ForbiddenException("Usuário não autenticado.");
      }
    }

    // 4) Papel efetivo
    const effectiveRole = String(user.systemRole ?? user.role ?? "")
      .toUpperCase()
      .trim();

    // 5) Descobre tenant: param OU header (aceita os dois)
    const candidateTenantId: string | undefined =
      (req.params &&
        typeof req.params.tenantId === "string" &&
        req.params.tenantId) ||
      (req.headers[TENANT_HEADER] as string) ||
      (req.headers[String(TENANT_HEADER).toUpperCase()] as string) ||
      undefined;

    // 6) SUPERADMIN → requer tenant explícito (param ou header)
    if (effectiveRole === "SUPERADMIN") {
      if (!candidateTenantId) {
        throw new BadRequestException(
          TenantErrors.MISSING_HEADER_FOR_SUPERADMIN
        );
      }
      if (
        typeof candidateTenantId !== "string" ||
        candidateTenantId.length < 10
      ) {
        throw new BadRequestException("X-Tenant-Id inválido.");
      }
      req.tenantId = candidateTenantId;
      return true;
    }

    // 7) Demais papéis → tenant do token (e valida coincidência se veio na rota)
    const tokenTenant = user.tenantId;
    if (!tokenTenant) {
      throw new ForbiddenException(TenantErrors.MISSING_TENANT_IN_TOKEN);
    }
    if (candidateTenantId && candidateTenantId !== tokenTenant) {
      throw new ForbiddenException(
        "Tenant da rota/headers diverge do tenant do token."
      );
    }
    req.tenantId = tokenTenant;
    return true;
  }
}
