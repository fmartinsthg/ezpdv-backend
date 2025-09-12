import {
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  IsUUID,
  IsEnum,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { PrepStation } from "@prisma/client";

const DECIMAL_REGEX = /^-?\d+(\.\d+)?$/; // aceita "55", "55.0", "55.00"

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: "Produto Exemplo" })
  name!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: "Descrição do produto", required: false })
  description?: string;

  @IsNotEmpty({ message: "O preço é obrigatório." })
  @Matches(DECIMAL_REGEX, {
    message: 'price deve ser decimal em string, ex: "55.00"',
  })
  @ApiProperty({
    type: String,
    example: "15.00",
    description: "Preço em string com 2 casas decimais",
  })
  price!: string;

  @IsNotEmpty({ message: "O custo é obrigatório." })
  @Matches(DECIMAL_REGEX, {
    message: 'cost deve ser decimal em string, ex: "30.00"',
  })
  @ApiProperty({
    type: String,
    example: "10.00",
    description: "Custo em string com 2 casas decimais",
  })
  cost!: string;

  @IsNotEmpty({ message: "O estoque é obrigatório." })
  @Matches(/^\d+(\.\d{1,3})?$/, {
    message: 'stock deve ser decimal em string, ex: "50.000"',
  })
  @ApiProperty({
    type: String,
    example: "50.000",
    description: "Estoque em string com 3 casas decimais",
  })
  stock!: string;

  @IsNotEmpty({ message: "O ID da categoria é obrigatório." })
  @IsUUID("4", { message: "categoryId deve ser um UUID v4 válido." })
  @ApiProperty({ example: "uuid-v4", description: "ID da categoria" })
  categoryId!: string;

  // 👇 novo: estação de preparo opcional
  @ApiPropertyOptional({
    enum: PrepStation,
    example: "BAR",
    description: "Estação padrão de preparo para roteamento no KDS",
  })
  @IsEnum(PrepStation)
  @IsOptional()
  @Transform(({ value }) => (value ? String(value).toUpperCase() : value))
  prepStation?: PrepStation;
}
