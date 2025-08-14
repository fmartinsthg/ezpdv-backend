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
const DECIMAL_REGEX = /^-?\d+(\.\d+)?$/; // aceita "55", "55.0", "55.00"
class CreateProductDto {
}
exports.CreateProductDto = CreateProductDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProductDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "O preço é obrigatório." }),
    (0, class_validator_1.Matches)(DECIMAL_REGEX, {
        message: 'price deve ser decimal em string, ex: "55.00"',
    }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "O custo é obrigatório." }),
    (0, class_validator_1.Matches)(DECIMAL_REGEX, {
        message: 'cost deve ser decimal em string, ex: "30.00"',
    }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "cost", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: "O estoque deve ser um número inteiro." }),
    (0, class_validator_1.Min)(0, { message: "O estoque não pode ser negativo." }),
    __metadata("design:type", Number)
], CreateProductDto.prototype, "stock", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: "O ID da categoria é obrigatório." }),
    (0, class_validator_1.IsUUID)("4", { message: "categoryId deve ser um UUID válido." }),
    __metadata("design:type", String)
], CreateProductDto.prototype, "categoryId", void 0);
