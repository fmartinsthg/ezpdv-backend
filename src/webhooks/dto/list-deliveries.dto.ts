// src/webhooks/dto/list-deliveries.dto.ts
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class ListDeliveriesDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() eventType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
