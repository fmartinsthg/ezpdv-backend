"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecimalSerializationInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
/**
 * Interceptor global para serialização de valores Prisma.Decimal.
 * - Dinheiro: string com 2 casas decimais (ex: "15.00")
 * - Quantidade/estoque: string com 3 casas decimais (ex: "50.000")
 * - Não afeta streams, buffers ou binários
 * - Recursivo para arrays/objetos aninhados
 *
 * Registro: app.useGlobalInterceptors(new DecimalSerializationInterceptor())
 */
let DecimalSerializationInterceptor = class DecimalSerializationInterceptor {
    intercept(_context, next) {
        return next.handle().pipe((0, operators_1.map)((data) => this.serializeDecimals(data)));
    }
    serializeDecimals(data) {
        if (data === null || data === undefined)
            return data;
        if (Buffer.isBuffer(data) || data instanceof Uint8Array)
            return data;
        if (typeof data === "object") {
            // Stream/Response check (NestJS Response, etc)
            if (typeof data.pipe === "function")
                return data;
            if (Array.isArray(data)) {
                return data.map((item) => this.serializeDecimals(item));
            }
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                if (this.isDecimal(value)) {
                    result[key] = this.formatDecimal(key, value);
                }
                else if (typeof value === "object" && value !== null) {
                    result[key] = this.serializeDecimals(value);
                }
                else {
                    result[key] = value;
                }
            }
            return result;
        }
        return data;
    }
    isDecimal(value) {
        // Prisma Decimal pode ser importado de diferentes lugares dependendo da versão
        return (value &&
            typeof value === "object" &&
            typeof value.toFixed === "function" &&
            typeof value.toString === "function");
    }
    /**
     * Formata o valor Decimal conforme o campo:
     * - Campos de dinheiro: 2 casas decimais
     * - Campos de quantidade/estoque: 3 casas decimais
     * - Default: string
     */
    formatDecimal(key, value) {
        if (this.isMoneyField(key)) {
            return value.toFixed(2);
        }
        if (this.isQuantityField(key)) {
            return value.toFixed(3);
        }
        return value.toString();
    }
    isMoneyField(key) {
        const moneyFields = [
            "price",
            "cost",
            "total",
            "amount",
            "valor",
            "subtotal",
        ];
        return moneyFields.some((field) => key.toLowerCase().includes(field));
    }
    isQuantityField(key) {
        const quantityFields = ["stock", "quantity", "quantidade", "estoque"];
        return quantityFields.some((field) => key.toLowerCase().includes(field));
    }
};
exports.DecimalSerializationInterceptor = DecimalSerializationInterceptor;
exports.DecimalSerializationInterceptor = DecimalSerializationInterceptor = __decorate([
    (0, common_1.Injectable)()
], DecimalSerializationInterceptor);
