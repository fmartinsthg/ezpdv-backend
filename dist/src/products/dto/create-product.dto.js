"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProductDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const DECIMAL_REGEX = /^-?\d+(\.\d+)?$/; // "55", "55.0", "55.00"
class CreateProductDto {
}
exports.CreateProductDto = CreateProductDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    (0, swagger_1.ApiProperty)({ example: "Produto Exemplo" }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, swagger_1.ApiProperty)({ example: "Descrição do produto", required: false }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "O preço é obrigatório." }),
    (0, class_validator_1.Matches)(DECIMAL_REGEX, {
        message: 'price deve ser decimal em string, ex: "55.00"',
    }),
    (0, swagger_1.ApiProperty)({
        type: String,
        example: "15.00",
        description: "Preço em string com 2+ casas decimais",
    }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "O custo é obrigatório." }),
    (0, class_validator_1.Matches)(DECIMAL_REGEX, {
        message: 'cost deve ser decimal em string, ex: "30.00"',
    }),
    (0, swagger_1.ApiProperty)({
        type: String,
        example: "10.00",
        description: "Custo em string com 2+ casas decimais",
    }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "cost", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "O ID da categoria é obrigatório." }),
    (0, class_validator_1.IsUUID)("4", { message: "categoryId deve ser um UUID v4 válido." }),
    (0, swagger_1.ApiProperty)({ example: "uuid-v4", description: "ID da categoria" }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "categoryId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: client_1.PrepStation,
        example: "BAR",
        description: "Estação padrão de preparo para roteamento no KDS",
    }),
    (0, class_validator_1.IsEnum)(client_1.PrepStation),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value ? String(value).toUpperCase() : value)),
    __metadata("design:type", String)
], CreateProductDto.prototype, "prepStation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateProductDto.prototype, "isActive", void 0);
