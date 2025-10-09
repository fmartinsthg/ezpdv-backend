import { IsEnum, IsString, IsNumberString, IsOptional } from 'class-validator';

export enum MovementType { SUPRIMENTO = 'SUPRIMENTO', SANGRIA = 'SANGRIA' }

export class CreateMovementDto {
  @IsEnum(MovementType)
  type!: MovementType;

  // Negócio restringe a CASH; validado no service
  @IsString()
  method!: 'CASH';

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
