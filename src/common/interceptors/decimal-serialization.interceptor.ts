import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Interceptor global para serialização de valores Prisma.Decimal.
 * - Dinheiro: string com 2 casas decimais (ex: "15.00")
 * - Quantidade/estoque: string com 3 casas decimais (ex: "50.000")
 * - Não afeta streams, buffers ou binários
 * - Recursivo para arrays/objetos aninhados
 *
 * Registro: app.useGlobalInterceptors(new DecimalSerializationInterceptor())
 */
@Injectable()
export class DecimalSerializationInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.serializeDecimals(data)));
  }

  private serializeDecimals(data: any): any {
    if (data === null || data === undefined) return data;
    if (Buffer.isBuffer(data) || data instanceof Uint8Array) return data;
    if (typeof data === "object") {
      // Stream/Response check (NestJS Response, etc)
      if (typeof data.pipe === "function") return data;
      if (Array.isArray(data)) {
        return data.map((item) => this.serializeDecimals(item));
      }
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isDecimal(value)) {
          result[key] = this.formatDecimal(key, value);
        } else if (typeof value === "object" && value !== null) {
          result[key] = this.serializeDecimals(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    return data;
  }

  private isDecimal(value: any): value is Decimal {
    // Prisma Decimal pode ser importado de diferentes lugares dependendo da versão
    return (
      value &&
      typeof value === "object" &&
      typeof value.toFixed === "function" &&
      typeof value.toString === "function"
    );
  }

  /**
   * Formata o valor Decimal conforme o campo:
   * - Campos de dinheiro: 2 casas decimais
   * - Campos de quantidade/estoque: 3 casas decimais
   * - Default: string
   */
  private formatDecimal(key: string, value: Decimal): string {
    if (this.isMoneyField(key)) {
      return value.toFixed(2);
    }
    if (this.isQuantityField(key)) {
      return value.toFixed(3);
    }
    return value.toString();
  }

  private isMoneyField(key: string): boolean {
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

  private isQuantityField(key: string): boolean {
    const quantityFields = ["stock", "quantity", "quantidade", "estoque"];
    return quantityFields.some((field) => key.toLowerCase().includes(field));
  }
}
