import {
  IsNumberString,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

export class AdjustInventoryItemDto {
  @ValidateIf((o) => o.delta === undefined)
  @IsNumberString()
  newOnHand?: string;

  @ValidateIf((o) => o.newOnHand === undefined)
  @IsNumberString()
  delta?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
