import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { SystemRole, TenantRole } from "@prisma/client";
import { LoginUserDto } from "../users/dto/login-user.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  /** Busca o usuário com memberships e valida a senha */
  private async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: true }, // pega vínculos com tenants
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    return user;
  }

  /** Login com suporte a multi-tenant */
  async login(dto: LoginUserDto) {
    const user = await this.validateUser(dto.email, dto.password);

    // Determinar o contexto do tenant e o papel dentro do tenant
    let selectedTenantId: string | null = null;
    let tenantRole: TenantRole | null = null;

    if (user.systemRole === SystemRole.SUPERADMIN) {
      // SUPERADMIN opera sem tenant por padrão (rotas de plataforma)
      selectedTenantId = null;
      tenantRole = null;
    } else {
      const memberships = user.memberships;

      if (!memberships || memberships.length === 0) {
        throw new UnauthorizedException(
          "Usuário não possui acesso a nenhum restaurante."
        );
      }

      if (dto.tenantId) {
        const m = memberships.find((mm) => mm.tenantId === dto.tenantId);
        if (!m) {
          throw new BadRequestException(
            "Usuário não é membro do restaurante informado."
          );
        }
        selectedTenantId = m.tenantId;
        tenantRole = m.role;
      } else if (memberships.length === 1) {
        selectedTenantId = memberships[0].tenantId;
        tenantRole = memberships[0].role;
      } else {
        // Usuário pertence a vários tenants e não informou tenantId
        throw new BadRequestException(
          "Usuário pertence a múltiplos restaurantes. Informe o tenantId no login."
        );
      }
    }

    const payload = {
      sub: user.id,
      systemRole: user.systemRole, // SUPERADMIN | SUPPORT | NONE
      tenantId: selectedTenantId, // null para SUPERADMIN
      role: tenantRole, // TenantRole no contexto do tenant, ou null
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
