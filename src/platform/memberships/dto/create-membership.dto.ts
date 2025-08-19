import { IsEnum, IsUUID } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class CreateMembershipDto {
  @IsUUID()
  userId!: string;

  @IsEnum(TenantRole, { message: `role deve ser um de: ${Object.values(TenantRole).join(', ')}` })
  role!: TenantRole;
}
