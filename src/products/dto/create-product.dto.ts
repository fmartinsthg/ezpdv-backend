import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, IsInt } from "class-validator";
import { Type } from "class-transformer";

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'O preço deve ser um valor positivo.' })
  price!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'O custo deve ser um valor positivo.' })
  cost!: number;

  @Type(() => Number)
  @IsInt({ message: 'O estoque deve ser um número inteiro.' })
  @Min(0, { message: 'O estoque não pode ser negativo.' })
  stock!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
