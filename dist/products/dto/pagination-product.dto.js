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
exports.ProductPaginationDto = void 0;
// src/products/dto/pagination-product.dto.ts
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const swagger_1 = require("@nestjs/swagger");
class ProductPaginationDto extends pagination_dto_1.PaginationDto {
    constructor() {
        super(...arguments);
        this.sortBy = "name";
    }
}
exports.ProductPaginationDto = ProductPaginationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: "Sort by field for products",
        enum: ["name", "price", "stock", "createdAt", "updatedAt"],
        default: "name",
    }),
    (0, class_validator_1.IsEnum)(["name", "price", "stock", "createdAt", "updatedAt"]),
    __metadata("design:type", String)
], ProductPaginationDto.prototype, "sortBy", void 0);
