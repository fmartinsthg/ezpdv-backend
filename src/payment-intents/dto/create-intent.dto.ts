import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiPropertyOptional({ description: 'Data/hora de expiração do intent (opcional, ISO8601)' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
