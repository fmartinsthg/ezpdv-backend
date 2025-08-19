// src/platform/platform.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { MembershipsModule } from './memberships/memberships.module';

@Module({
  imports: [PrismaModule, TenantsModule, MembershipsModule],
})
export class PlatformModule {}
