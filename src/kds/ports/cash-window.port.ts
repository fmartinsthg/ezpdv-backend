export type CashWindow = { from: Date; to?: Date } | null;

/** Porta de integração: devolve a janela (from..to?) do caixa aberto do tenant. */
export abstract class CashWindowPort {
  abstract getCurrentWindow(tenantId: string): Promise<CashWindow>;
}
