import {
  IsOptional,
  IsBooleanString,
  IsUUID,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ProductsQueryDto {
  /** busca por nome/descrição/barcode */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  /** filtrar por categoria */
  @IsOptional()
  @IsUUID('4', { message: 'categoryId deve ser um UUID v4 válido.' })
  categoryId?: string;

  /** filtrar por ativo/inativo */
  @IsOptional()
  @IsBooleanString()
  isActive?: string; // "true" | "false"

  /** ordenação */
  @IsOptional()
  @IsIn(['name', 'price', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'price' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  /** paginação */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
