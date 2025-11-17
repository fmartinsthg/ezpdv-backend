import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class RefundPaymentFromFacadeDto {
  @ApiProperty({
    example: "50.00",
    description: "Valor a estornar (2 casas, string)",
  })
  @IsNumberString()
  amount!: string;

  @ApiPropertyOptional({ example: "Ajuste/erro de digitação" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
