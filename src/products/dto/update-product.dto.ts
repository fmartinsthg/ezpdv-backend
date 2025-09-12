// src/products/dto/update-product.dto.ts
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
  // Ativo/inativo
  isActive?: boolean;

  // 👇 redeclara prepStation aceitando null no update
  @ApiPropertyOptional({
    enum: PrepStation,
    example: "KITCHEN",
    nullable: true,
  })
  @IsEnum(PrepStation)
  @IsOptional()
  @Transform(({ value }) =>
    value === null ? null : value ? String(value).toUpperCase() : value
  )
  prepStation?: PrepStation | null;
}
