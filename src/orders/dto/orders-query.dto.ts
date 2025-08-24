import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, IsBooleanString, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class OrdersQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus, description: 'OPEN | CLOSED | CANCELED' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ example: true, description: 'Listar apenas comandas do usuário logado' })
  @IsOptional()
  @IsBooleanString()
  mine?: string;

  @ApiPropertyOptional({ example: '12', description: 'Filtro por tabNumber/comanda' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
