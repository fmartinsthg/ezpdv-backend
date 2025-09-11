import { Injectable } from "@nestjs/common";
import { CashWindow, CashWindowPort } from "../ports/cash-window.port";

/** MVP: não filtra por caixa; retorna null. */
@Injectable()
export class CashWindowNoneAdapter implements CashWindowPort {
  async getCurrentWindow(_: string): Promise<CashWindow> {
    return null;
  }
}
