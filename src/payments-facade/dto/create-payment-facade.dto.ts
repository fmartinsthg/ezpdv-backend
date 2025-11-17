import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PaymentMethod } from "@prisma/client";

/**
 * Body aceito pelo façade (sem orderId, pois vem no path).
 * No service, isso é convertido para o CreatePaymentDto oficial (que exige orderId).
 */
export class CreatePaymentFromFacadeDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CARD })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({
    example: "100.00",
    description: "2 casas decimais (string p/ precisão)",
  })
  @IsNumberString()
  amount!: string;

  @ApiPropertyOptional({ example: "NULL" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @ApiPropertyOptional({ example: "null_6f6a42f0-92c2-4cf1-8f4c-8f9b47d4b1c0" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerTxnId?: string;

  @ApiPropertyOptional({ example: { entryMode: "chip" } })
  @IsOptional()
  metadata?: Record<string, any>;
}
