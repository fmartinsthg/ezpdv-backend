// src/platform/memberships/memberships.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import { AuthUser } from "../../auth/jwt.strategy";
import { MembershipsService } from "./memberships.service";
import { CreateMembershipDto } from "./dto/create-membership.dto";
import { TenantRole } from "@prisma/client";

@UseGuards(JwtAuthGuard)
@Controller("tenants/:tenantId/memberships")
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  private resolveTenantScope(user: AuthUser, paramTenantId: string): string {
    if (user.systemRole === "SUPERADMIN") return paramTenantId;
    if (!user.tenantId || user.tenantId !== paramTenantId) {
      throw new ForbiddenException("Operação não permitida para este tenant.");
    }
    if (user.role !== TenantRole.ADMIN) {
      throw new ForbiddenException(
        "Apenas ADMIN do tenant pode gerenciar membros."
      );
    }
    return paramTenantId;
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param("tenantId", new ParseUUIDPipe()) tenantIdParam: string
  ) {
    const tenantId = this.resolveTenantScope(user, tenantIdParam);
    return this.service.list(tenantId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param("tenantId", new ParseUUIDPipe()) tenantIdParam: string,
    @Body() dto: CreateMembershipDto
  ) {
    const tenantId = this.resolveTenantScope(user, tenantIdParam);
    return this.service.create(tenantId, dto);
  }
}
