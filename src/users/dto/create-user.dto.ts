import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TenantRole } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  /** Papel do usuário no TENANT (ADMIN | MODERATOR | USER) */
  @IsEnum(TenantRole, {
    message: `role deve ser um de: ${Object.values(TenantRole).join(', ')}`,
  })
  @Transform(({ value }) => String(value).trim().toUpperCase())
  role!: TenantRole;

  /**
   * Opcional. Usado quando o SUPERADMIN cria usuário em um tenant específico.
   * Em rotas normais, o tenantId é inferido do token JWT e este campo é ignorado.
   */
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
