import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Matches,
  IsUUID,
} from "class-validator";

const DECIMAL_REGEX = /^-?\d+(\.\d+)?$/; // aceita "55", "55.0", "55.00"

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty({ message: "O preço é obrigatório." })
  @Matches(DECIMAL_REGEX, {
    message: 'price deve ser decimal em string, ex: "55.00"',
  })
  price!: string;

  @IsNotEmpty({ message: "O custo é obrigatório." })
  @Matches(DECIMAL_REGEX, {
    message: 'cost deve ser decimal em string, ex: "30.00"',
  })
  cost!: string;

  @IsInt({ message: "O estoque deve ser um número inteiro." })
  @Min(0, { message: "O estoque não pode ser negativo." })
  stock!: number;

  @IsNotEmpty({ message: "O ID da categoria é obrigatório." })
  @IsUUID("4", { message: "categoryId deve ser um UUID válido." })
  categoryId!: string;
}
