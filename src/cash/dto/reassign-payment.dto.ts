import { IsUUID } from 'class-validator';

export class ReassignPaymentDto {
  @IsUUID()
  paymentId!: string;
}
