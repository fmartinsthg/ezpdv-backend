import {
  IsBooleanString,
  IsNumberString,
  IsOptional,
  IsString,
} from "class-validator";

export class ListItemsDto {
  @IsOptional()
  @IsBooleanString()
  isIngredient?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumberString()
  lowStock?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  pageSize?: string;
}
