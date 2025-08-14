import { IsOptional, IsNumber, IsEnum, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export type SortBy = "name" | "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";

export class PaginationDto {
  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: "Items per page", default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Sort by field",
    enum: ["name", "createdAt", "updatedAt"],
    default: "name",
  })
  @IsOptional()
  @IsEnum(["name", "createdAt", "updatedAt"])
  sortBy?: SortBy;

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["asc", "desc"],
    default: "asc",
  })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortOrder?: SortOrder;

  constructor() {
    this.page = 1;
    this.limit = 10;
    this.sortBy = "name";
    this.sortOrder = "asc";
  }
}
