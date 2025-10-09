import { IsString, IsOptional, IsObject } from 'class-validator';

export class OpenSessionDto {
  @IsString()
  stationId!: string;

  @IsObject()
  openingFloat!: Record<string, string>; // ex: { "CASH":"150.00" }

  @IsOptional()
  @IsString()
  notes?: string;
}
