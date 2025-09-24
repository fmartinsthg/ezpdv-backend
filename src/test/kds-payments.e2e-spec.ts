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
} from "./helpers";

test("KDS + Pagamentos (fluxo completo: close → pay → settled → some do KDS)", async (t) => {
  console.log("[payments-v4] baseUrl/tenant loaded OK");

  let categoryId = "";
  let productId = "";
  let orderId = "";
  let orderVersion = "";
  let orderTotal = "0.00";

  await t.test("cria categoria (top-level, X-Tenant-Id)", async () => {
    categoryId = await createCategory();
    console.log("✓ categoria criada", categoryId);
    expect(Boolean(categoryId)).toBe(true);
  });

  await t.test(
    "cria produto (top-level, X-Tenant-Id) com prepStation e stock",
    async () => {
      productId = await createProduct(categoryId, station);
      console.log("✓ produto criado", productId);
      expect(Boolean(productId)).toBe(true);
    }
  );

  await t.test("cria comanda com 2 itens (idempotência)", async () => {
    const o = await createOrder(productId, 2);
    orderId = o.id;
    orderVersion = o.version; // pode ficar desatualizada depois do FIRE
    orderTotal = o.total;
    console.log("✓ comanda criada", { orderId, orderTotal });
    expect(orderId).toBeTruthy();
    expect(orderTotal).toMatch(/^\d+\.\d{2,}$/);
  });

  await t.test("FIRE itens (idempotência) e garante FIRED no KDS", async () => {
    await fireOrder(orderId);
    const kds = await until(
      () => listKdsFired(station),
      (r) =>
        r.status === 200 &&
        Array.isArray(r.body?.items) &&
        r.body.items.some((it: any) => it.orderId === orderId)
    );
    expect(kds.status).toBe(200);
    const firedFromOrder = (kds.body?.items || []).filter(
      (it: any) => it.orderId === orderId
    );
    expect(firedFromOrder.length > 0).toBe(true);
    console.log("✓ FIRE refletido no KDS");
  });

  await t.test(
    "fecha pedido (orders:close) → some do KDS; depois captura pagamento (valor total)",
    async () => {
      console.log(
        ">>> iniciando CLOSE (If-Match) + PAY + settled + verificação no KDS"
      );

      // 1) CLOSE (helpers tratam 412 e timeouts)
      await closeOrder(orderId, orderVersion);
      console.log("✓ order CLOSED");

      // 2) Confirma CLOSED (evita race)
      await until(
        () => getOrder(orderId),
        (o: any) => o.status === "CLOSED" || o.isClosed === true,
        { timeoutMs: 4000, intervalMs: 150 }
      );

      // 3) Paga o total (helpers alternam escopo e aplicam timeout)
      await capturePayment(orderId, orderTotal);
      console.log("✓ payment CAPTURED");

      // 4) Aguarda isSettled / SETTLED (se seu domínio sinaliza isso)
      await until(
        () => getOrder(orderId),
        (o: any) => o.isSettled === true || o.status === "SETTLED",
        { timeoutMs: 5000, intervalMs: 150 }
      );
      console.log("✓ order SETTLED");

      // 5) Garante que sumiu do KDS
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

      console.log("✓ KDS sem itens da comanda após pagamento/settled");
      console.log(">>> CLOSE + PAY + settled + KDS OK");
    }
  );
});
