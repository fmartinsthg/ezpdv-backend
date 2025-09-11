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
exports.BulkCompleteDto = exports.KdsListItemsQueryDto = exports.KdsListTicketsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
class KdsListTicketsQueryDto {
}
exports.KdsListTicketsQueryDto = KdsListTicketsQueryDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.PrepStation),
    __metadata("design:type", String)
], KdsListTicketsQueryDto.prototype, "station", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.OrderItemStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], KdsListTicketsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], KdsListTicketsQueryDto.prototype, "since", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => parseInt(value, 10)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], KdsListTicketsQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => parseInt(value, 10)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], KdsListTicketsQueryDto.prototype, "pageSize", void 0);
class KdsListItemsQueryDto {
}
exports.KdsListItemsQueryDto = KdsListItemsQueryDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.PrepStation),
    __metadata("design:type", String)
], KdsListItemsQueryDto.prototype, "station", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.OrderItemStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], KdsListItemsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => parseInt(value, 10)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], KdsListItemsQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => parseInt(value, 10)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], KdsListItemsQueryDto.prototype, "pageSize", void 0);
class BulkCompleteDto {
}
exports.BulkCompleteDto = BulkCompleteDto;
__decorate([
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BulkCompleteDto.prototype, "itemIds", void 0);
