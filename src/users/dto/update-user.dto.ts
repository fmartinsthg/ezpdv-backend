import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";
import { TenantRole } from "@prisma/client";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  /**
   * Atualiza o papel do usuário NO TENANT.
   * Envie `role: null` para remover o vínculo (o controller/service tratará isso).
   * - Se `role === null`, os validadores abaixo são ignorados.
   * - Se for string, precisa ser um TenantRole válido.
   */
  @IsOptional()
  @ValidateIf((o) => o.role !== null && o.role !== undefined)
  @IsEnum(TenantRole, {
    message: `role deve ser um de: ${Object.values(TenantRole).join(", ")}`,
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value
  )
  role?: TenantRole | null;
}
