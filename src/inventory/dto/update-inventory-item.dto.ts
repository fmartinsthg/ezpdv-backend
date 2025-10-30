import {
  IsBoolean,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
} from "class-validator";
import { InventoryUnit } from "./create-inventory-item.dto";

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(InventoryUnit)
  unit?: InventoryUnit;

  @IsOptional()
  @IsNumberString()
  factorToBase?: string;

  @IsOptional()
  @IsBoolean()
  isIngredient?: boolean;
}
