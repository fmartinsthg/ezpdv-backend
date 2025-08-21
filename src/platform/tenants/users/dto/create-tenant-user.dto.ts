import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class CreateTenantUserDto {
  @IsNotEmpty() @IsString() name!: string;
  @IsEmail() email!: string;
  @MinLength(6) @IsString() password!: string;

  // opcional: permitir ADMIN criar já como MODERATOR/USER (padrão USER)
  @IsOptional() @IsEnum(TenantRole) role?: TenantRole; 
}