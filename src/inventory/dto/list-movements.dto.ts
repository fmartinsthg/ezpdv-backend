import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class ListMovementsDto {
  @IsOptional() @IsString()
  inventoryItemId?: string;

  @IsOptional() @IsEnum(StockMovementType)
  type?: StockMovementType;

  @IsOptional() @IsString()
  relatedOrderId?: string;

  @IsOptional() @IsString()
  dateFrom?: string; // ISO

  @IsOptional() @IsString()
  dateTo?: string; // ISO

  @IsOptional() @IsNumberString()
  page?: string;

  @IsOptional() @IsNumberString()
  pageSize?: string;
}
