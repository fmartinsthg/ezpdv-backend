// src/webhooks/dto/replay.dto.ts
import { IsArray, IsDateString, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class ReplayDto {
  @IsString() type!: string; // ex: 'order.closed'
  @IsOptional() @IsArray() @IsString({ each: true }) eventIds?: string[];
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
