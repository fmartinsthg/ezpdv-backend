// src/webhooks/dto/create-endpoint.dto.ts
import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, ArrayNotEmpty } from 'class-validator';

export class CreateEndpointDto {
  @IsUrl() url!: string;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) events!: string[];
  @IsOptional() @IsString() secret?: string;
}
