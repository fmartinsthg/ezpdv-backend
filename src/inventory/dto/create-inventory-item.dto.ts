import { IsBoolean, IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';

export enum InventoryUnit {
  ML = 'ML',
  L = 'L',
  UNIT = 'UNIT',
}

export class CreateInventoryItemDto {
  @IsString()
  name!: string;

  @IsEnum(InventoryUnit)
  unit!: InventoryUnit;

  // Decimals como string no DTO → converte para Decimal no service
  @IsNumberString() // > 0
  factorToBase!: string;

  @IsNumberString() // >= 0
  onHand!: string;

  @IsBoolean()
  isIngredient!: boolean;
}
