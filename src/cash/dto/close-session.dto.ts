import { IsOptional, IsString } from 'class-validator';

export class CloseSessionDto {
  @IsOptional()
  @IsString()
  note?: string;
}
