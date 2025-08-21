// src/platform/platform.module.ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TenantsModule } from "./tenants/tenants.module";
import { MembershipsModule } from "./memberships/memberships.module";
import { TenantUsersModule } from "./tenants/users/tenant-users.module";

@Module({
  imports: [PrismaModule, TenantsModule, MembershipsModule, TenantUsersModule],
})
export class PlatformModule {}
