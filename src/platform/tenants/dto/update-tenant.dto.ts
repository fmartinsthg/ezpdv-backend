// src/platform/tenants/dto/update-tenant.dto.ts
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug deve conter apenas letras minúsculas, números e hífen',
  })
  slug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // se você adicionar essa coluna no Tenant
}
