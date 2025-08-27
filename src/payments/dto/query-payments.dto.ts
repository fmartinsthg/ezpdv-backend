import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsPositive, IsString } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class QueryPaymentsDto {
  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'Data inicial ISO (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Data final ISO (exclusive)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 20))
  @IsPositive()
  pageSize?: number = 20;
}