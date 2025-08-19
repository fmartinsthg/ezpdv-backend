import { IsEnum } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { ApiPropertyOptional } from "@nestjs/swagger";

export type CategorySortBy = "name" | "createdAt" | "updatedAt";

export class CategoryPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Sort by field for categories",
    enum: ["name", "createdAt", "updatedAt"],
    default: "name",
  })
  @IsEnum(["name", "createdAt", "updatedAt"])
  sortBy: CategorySortBy = "name";
}
