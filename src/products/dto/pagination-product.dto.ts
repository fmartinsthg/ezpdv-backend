// src/products/dto/pagination-product.dto.ts
import { IsEnum } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { ApiPropertyOptional } from "@nestjs/swagger";

export type ProductSortBy =
  | "name"
  | "price"
  | "stock"
  | "createdAt"
  | "updatedAt";

export class ProductPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Sort by field for products",
    enum: ["name", "price", "stock", "createdAt", "updatedAt"],
    default: "name",
  })
  @IsEnum(["name", "price", "stock", "createdAt", "updatedAt"])
  sortBy: ProductSortBy = "name";
}
