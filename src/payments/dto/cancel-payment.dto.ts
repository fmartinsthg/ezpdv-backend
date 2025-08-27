import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelPaymentDto {
  @ApiPropertyOptional({ example: 'Timeout no PSP', description: 'Motivo do cancelamento' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}