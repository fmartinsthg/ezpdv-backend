import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";

/** Decorator para rotas que NÃO exigem sessão de caixa aberta */
export const ALLOW_WITHOUT_CASH_SESSION_KEY = "ALLOW_WITHOUT_CASH_SESSION";
export const AllowWithoutCashSession =
  () => (target: any, key?: string, desc?: PropertyDescriptor) => {
    Reflect.defineMetadata(
      ALLOW_WITHOUT_CASH_SESSION_KEY,
      true,
      desc ? desc.value : target
    );
    return desc ?? target;
  };

/**
 * Exige sessão de caixa ABERTA por tenant.
 * Se CASH_REQUIRE_TODAY=true, a sessão precisa ter sido aberta "hoje"
 * no fuso definido por CASH_TZ_OFFSET_MIN (minutos; default -180 = UTC-03).
 */
@Injectable()
export class RequireOpenCashSessionGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const allow = this.reflector.get<boolean>(
      ALLOW_WITHOUT_CASH_SESSION_KEY,
      ctx.getHandler()
    );
    if (allow) return true;

    const req = ctx.switchToHttp().getRequest();
    const tenantId: string | undefined = req?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        "Contexto do restaurante (tenant) não encontrado."
      );
    }

    const requireToday =
      String(process.env.CASH_REQUIRE_TODAY || "").toLowerCase() === "true";

    let session: { id: string } | null = null;

    if (requireToday) {
      const tzOffsetMin = Number(process.env.CASH_TZ_OFFSET_MIN ?? -180); // Fortaleza padrão
      const nowUtc = new Date();
      const nowLocalMs = nowUtc.getTime() + tzOffsetMin * 60_000;

      const local = new Date(nowLocalMs);
      const startLocal = new Date(local);
      startLocal.setHours(0, 0, 0, 0);
      const endLocal = new Date(local);
      endLocal.setHours(23, 59, 59, 999);

      const startUtc = new Date(startLocal.getTime() - tzOffsetMin * 60_000);
      const endUtc = new Date(endLocal.getTime() - tzOffsetMin * 60_000);

      session = await this.prisma.cashSession.findFirst({
        where: {
          tenantId,
          status: "OPEN",
          openedAt: { gte: startUtc, lte: endUtc },
        },
        select: { id: true },
      });
    } else {
      session = await this.prisma.cashSession.findFirst({
        where: { tenantId, status: "OPEN" },
        select: { id: true },
      });
    }

    if (!session) {
      throw new ConflictException(
        "Não há sessão de caixa ABERTA para este restaurante. Abra o caixa para continuar."
      );
    }

    (req as any).cashSession = session; // útil nos services
    return true;
  }
}
