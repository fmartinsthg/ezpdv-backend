import { IsEmail, IsOptional, IsString } from 'class-validator';
export class LoginUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
