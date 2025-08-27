import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CARD })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod; // definite assignment

  // Usamos string para preservar precisão e converter para Decimal no service
  @ApiProperty({ example: '100.00', description: 'Valor a capturar (2 casas decimais). String para precisão.' })
  @IsNumberString()
  amount!: string; // definite assignment

  @ApiPropertyOptional({ example: 'NULL', description: 'Identificador do provedor de pagamento (ex.: NULL, MOCK, STONE, ADYEN...)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @ApiPropertyOptional({ example: 'null_6f6a42f0-92c2-4cf1-8f4c-8f9b47d4b1c0', description: 'ID/token do provedor retornado pelo SmartPOS/PSP' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerTxnId?: string;

  @ApiPropertyOptional({ example: { entryMode: 'chip', aid: 'A0000000031010' }, description: 'Metadados não sensíveis (JSON)' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ example: 'c0a8012e-7e3b-4b33-9fcd-42f7698c3a21', description: 'Order ID (CLOSED) a receber o pagamento' })
  @IsUUID()
  orderId!: string; // definite assignment
}
