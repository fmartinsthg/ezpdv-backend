import {
  ArrayNotEmpty,
  IsArray,
  IsNumberString,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class UpsertRecipeLineDto {
  @IsString()
  inventoryItemId!: string;

  @IsNumberString() // > 0
  qtyBase!: string;
}

export class UpsertRecipeDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UpsertRecipeLineDto)
  lines!: UpsertRecipeLineDto[];
}
