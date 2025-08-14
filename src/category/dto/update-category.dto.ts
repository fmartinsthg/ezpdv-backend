import { PartialType } from "@nestjs/swagger";
import { CreateCategoryDto } from "./create-category.dto";
import { IsString, IsOptional, IsBoolean } from "class-validator";

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  parentId?: string;
}
