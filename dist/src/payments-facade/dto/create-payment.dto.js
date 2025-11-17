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
exports.CreatePaymentFromFacadeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
/**
 * Body aceito pelo façade (sem orderId, pois vem no path).
 * No service, isso é convertido para o CreatePaymentDto oficial (que exige orderId).
 */
class CreatePaymentFromFacadeDto {
}
exports.CreatePaymentFromFacadeDto = CreatePaymentFromFacadeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.PaymentMethod, example: client_1.PaymentMethod.CARD }),
    (0, class_validator_1.IsEnum)(client_1.PaymentMethod),
    __metadata("design:type", String)
], CreatePaymentFromFacadeDto.prototype, "method", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '100.00', description: '2 casas decimais (string p/ precisão)' }),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreatePaymentFromFacadeDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'NULL' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreatePaymentFromFacadeDto.prototype, "provider", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'null_6f6a42f0-92c2-4cf1-8f4c-8f9b47d4b1c0' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreatePaymentFromFacadeDto.prototype, "providerTxnId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { entryMode: 'chip' } }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreatePaymentFromFacadeDto.prototype, "metadata", void 0);
