import { PartialType, OmitType, ApiPropertyOptional } from "@nestjs/swagger";
import { CreateProductDto } from "./create-product.dto";
import { IsOptional, IsBoolean, IsEnum } from "class-validator";
import { Transform } from "class-transformer";
import { PrepStation } from "@prisma/client";

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ["prepStation"] as const)
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: PrepStation,
    example: "KITCHEN",
    nullable: true,
    description: "Estação de preparo; envie null para limpar",
  })
  @IsEnum(PrepStation)
  @IsOptional()
  @Transform(({ value }) =>
    value === null ? null : value ? String(value).toUpperCase() : value
  )
  prepStation?: PrepStation | null;
}
