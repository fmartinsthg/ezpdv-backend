import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CloseOrderDto {
  @ApiPropertyOptional({ example: 'Fechamento no caixa 01' })
  @IsOptional()
  @IsString()
  note?: string;
}
