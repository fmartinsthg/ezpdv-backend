import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RefundPaymentDto {
  @ApiProperty({ example: '50.00', description: 'Valor a estornar (parcial ou total). String para precisão.' })
  @IsNumberString()
  amount!: string; // definite assignment

  @ApiPropertyOptional({ example: 'Cliente devolveu o produto', description: 'Motivo interno para auditoria' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
