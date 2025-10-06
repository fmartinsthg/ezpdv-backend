import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  // Pode ser UUID ou slug, conforme sua estratégia
  @IsOptional()
  @IsString()
  tenant?: string;
}
