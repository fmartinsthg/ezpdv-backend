import { IsNotEmpty, IsString, IsNumber, IsOptional } from "class-validator";

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNumber()
  price!: number;

  @IsNumber()
  cost!: number;

  @IsNumber()
  stock!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
