import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsUUID, IsNotEmpty, IsOptional, IsNumberString } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({ example: 'uuid-v4' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: '2.000', description: 'Quantidade (string, até 3 casas decimais)' })
  @IsNumberString()
  quantity: string;

  @ApiProperty({ example: '15.00', description: 'Preço unitário (string, 2 casas decimais)' })
  @IsNumberString()
  unitPrice: string;
}

export class PaymentDto {
  @ApiProperty({ example: 'CASH', enum: ['CASH', 'CARD', 'PIX', 'OTHER'] })
  @IsNotEmpty()
  method: string;

  @ApiProperty({ example: '30.00', description: 'Valor do pagamento (string, 2 casas decimais)' })
  @IsNumberString()
  amount: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ type: [PaymentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];

  @ApiProperty({ example: '5.00', required: false })
  @IsOptional()
  @IsNumberString()
  discount?: string;
}
