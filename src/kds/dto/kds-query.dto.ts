import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  ArrayNotEmpty,
} from "class-validator";
import { Transform } from "class-transformer";
import { PrepStation, OrderItemStatus } from "@prisma/client";

export class KdsListTicketsQueryDto {
  @IsEnum(PrepStation)
  station!: PrepStation; // definite assignment

  @IsEnum(OrderItemStatus)
  @IsOptional()
  status?: OrderItemStatus; // default aplicado no controller

  @IsISO8601()
  @IsOptional()
  since?: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}

export class KdsListItemsQueryDto {
  @IsEnum(PrepStation)
  station!: PrepStation;

  @IsEnum(OrderItemStatus)
  @IsOptional()
  status?: OrderItemStatus;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}

export class BulkCompleteDto {
  @ArrayNotEmpty()
  @IsString({ each: true })
  itemIds!: string[];
}
