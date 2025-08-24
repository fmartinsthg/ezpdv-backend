import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VoidItemDto {
  @ApiProperty({ example: 'Erro de lançamento / cliente desistiu' })
  @IsString()
  @MinLength(3)
  reason!: string;
}
