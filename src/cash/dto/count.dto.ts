import { IsEnum, IsObject, IsNumberString } from 'class-validator';

export enum CountKind { PARTIAL = 'PARTIAL', FINAL = 'FINAL' }

export class CreateCountDto {
  @IsEnum(CountKind)
  kind!: CountKind;

  @IsObject()
  denominations!: Record<string, number>;

  @IsNumberString()
  total!: string;
}
