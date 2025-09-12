import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Min,
  ArrayNotEmpty,
  IsString,
} from "class-validator";
import { Transform } from "class-transformer";
import { PrepStation, OrderItemStatus } from "@prisma/client";

export class KdsListTicketsQueryDto {
  @Transform(({ value }) => String(value).toUpperCase())
  @IsEnum(PrepStation)
  station!: PrepStation;

  @Transform(({ value }) =>
    value == null ? value : String(value).toUpperCase()
  )
  @IsEnum(OrderItemStatus)
  @IsOptional()
  status?: OrderItemStatus;

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
  @Transform(({ value }) => String(value).toUpperCase())
  @IsEnum(PrepStation)
  station!: PrepStation;

  @Transform(({ value }) =>
    value == null ? value : String(value).toUpperCase()
  )
  @IsEnum(OrderItemStatus)
  @IsOptional()
  status?: OrderItemStatus;

  @IsISO8601()
  @IsOptional()
  since?: string; // 👈 agora também disponível no /kds/items

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
