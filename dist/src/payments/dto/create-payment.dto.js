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
exports.CreatePaymentDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
class CreatePaymentDto {
}
exports.CreatePaymentDto = CreatePaymentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.PaymentMethod, example: client_1.PaymentMethod.CARD }),
    (0, class_validator_1.IsEnum)(client_1.PaymentMethod),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "method", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '100.00', description: 'Valor a capturar (2 casas decimais). String para precisão.' }),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'NULL', description: 'Identificador do provedor de pagamento (ex.: NULL, MOCK, STONE, ADYEN...)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "provider", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'null_6f6a42f0-92c2-4cf1-8f4c-8f9b47d4b1c0', description: 'ID/token do provedor retornado pelo SmartPOS/PSP' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "providerTxnId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { entryMode: 'chip', aid: 'A0000000031010' }, description: 'Metadados não sensíveis (JSON)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreatePaymentDto.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'c0a8012e-7e3b-4b33-9fcd-42f7698c3a21', description: 'Order ID (CLOSED) a receber o pagamento' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "orderId", void 0);
