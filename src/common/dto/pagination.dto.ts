// src/common/dto/pagination.dto.ts
import { IsOptional, IsNumber, Min, Max, IsEnum, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export type SortOrder = "asc" | "desc";

export class PaginationDto {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"],
    default: "asc",
  })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortOrder: SortOrder = "asc";

  @ApiPropertyOptional({ description: "Sort by field", default: "createdAt" })
  @IsOptional()
  @IsString()
  sortBy: string = "createdAt";
}
