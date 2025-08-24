import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, IsUUID } from 'class-validator';

export class FireDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Lista de itemIds para FIRE; se omitido, aplica em todos STAGED',
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  itemIds?: string[];
}
