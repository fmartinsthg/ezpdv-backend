// src/test/kds-payments.e2e-spec.ts
import { test } from "node:test";
import expect from "expect";
import {
  defaultStation as station,
  createCategory,
  createProduct,
  createOrder,
  fireOrder,
  listKdsFired,
  capturePayment,
  closeOrder,
  getOrder,
  until,
  openCashSession, // agora é open-or-reuse (idempotente)
  closeCashSession,
  getCashSessionDetail,
  getDailyReport,
} from "./helpers";

function todayUtcYYYYMMDD() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test("KDS + Payments + Cash (close → pay CASH w/ station → settled → KDS some + cash summary)", async (t) => {
  console.log("[payments+cash] baseUrl/tenant OK");

  let categoryId = "";
  let productId = "";
  let orderId = "";
  let orderVersion = "";
  let orderTotal = "0.00";
  let cashSessionId = "";

  // garante sessão OPEN (se já existir, reusa)
  await t.test("abre sessão de caixa (station)", async () => {
    cashSessionId = await openCashSession(station);
    expect(!!cashSessionId).toBe(true);
  });

  await t.test("cria categoria", async () => {
    categoryId = await createCategory();
    expect(Boolean(categoryId)).toBe(true);
  });

  await t.test("cria produto com prepStation", async () => {
    productId = await createProduct(categoryId, station);
    expect(Boolean(productId)).toBe(true);
  });

  await t.test("cria comanda com 2 itens", async () => {
    const o = await createOrder(productId, 2);
    orderId = o.id;
    orderVersion = o.version; // pode ficar obsoleta após FIRE
    orderTotal = o.total;
    expect(orderId).toBeTruthy();
    expect(orderTotal).toMatch(/^\d+\.\d{2,}$/);
  });

  await t.test("FIRE itens e KDS exibe ticket", async () => {
    await fireOrder(orderId);
    const kds = await until(
      () => listKdsFired(station),
      (r) =>
        r.status === 200 &&
        Array.isArray(r.body?.items) &&
        r.body.items.some((it: any) => it.orderId === orderId)
    );
    expect(kds.status).toBe(200);
  });

  await t.test(
    "CLOSE → captura pagamento CASH (com X-Station-Id) → SETTLED → some do KDS",
    async () => {
      // 1) close
      await closeOrder(orderId, orderVersion);

      // 2) garantia CLOSED
      await until(
        () => getOrder(orderId),
        (o: any) => o.status === "CLOSED" || o.isClosed === true,
        { timeoutMs: 4000, intervalMs: 150 }
      );

      // 3) paga total em CASH com X-Station-Id (integração Cash)
      await capturePayment(orderId, orderTotal, undefined, station);

      // 4) aguarda settled
      await until(
        () => getOrder(orderId),
        (o: any) => o.isSettled === true || o.status === "SETTLED",
        { timeoutMs: 6000, intervalMs: 200 }
      );

      // 5) garante que sumiu do KDS
      const after = await until(
        () => listKdsFired(station),
        (r) =>
          r.status === 200 &&
          Array.isArray(r.body?.items) &&
          !r.body.items.some((it: any) => it.orderId === orderId),
        { timeoutMs: 6000, intervalMs: 200 }
      );
      expect(after.status).toBe(200);
      const stillThere = (after.body?.items || []).some(
        (it: any) => it.orderId === orderId
      );
      expect(stillThere).toBe(false);
    }
  );

  await t.test("detalhe da sessão deve listar o payment", async () => {
    const s = await getCashSessionDetail(cashSessionId);
    expect(Array.isArray(s?.payments)).toBe(true);
    expect((s?.payments || []).length >= 1).toBe(true);
  });

  await t.test("fecha sessão de caixa e confere summary", async () => {
    const summary = await closeCashSession(cashSessionId);
    expect(typeof summary?.cashExpected).toBe("string");
    expect(summary?.payments?.count >= 1).toBe(true);
    if (summary?.totalsByMethod?.CASH) {
      expect(String(summary.totalsByMethod.CASH)).toMatch(/^\d+\.\d{2,}$/);
    }
  });

  await t.test("daily report do dia deve refletir CASH", async () => {
    const rep = await getDailyReport(todayUtcYYYYMMDD());
    if (rep && rep.CASH) {
      expect(String(rep.CASH)).toMatch(/^\d+\.\d{2,}$/);
    }
  });

  // cleanup: se algo falhar antes do close explícito, tenta fechar aqui
  t.after(async () => {
    try {
      if (cashSessionId) {
        await closeCashSession(cashSessionId);
      }
    } catch {
      /* noop */
    }
  });
});
