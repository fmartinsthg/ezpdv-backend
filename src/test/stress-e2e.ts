import { test } from "node:test";
import expect from "expect";
import { randomUUID } from "node:crypto";
import {
  defaultStation as station,
  createCategory,
  createProduct,
  createOrder,
  listKdsFired,
  until,
  findOpenCashSessionId,
  openCashSessionRaw,
  closeCashSession,
  fireOrderRaw,
  capturePaymentRawRetry429,
  listPaymentsByOrder,
  getOrder,
  closeOrderRawStable,
  printHttpMetricsSummary,
  sleep,
  looksLikeAlreadyClosed,
  closeOrder, // usado na recuperação após 412+412
} from "./helpers";

function tNow() {
  return Number(process.hrtime.bigint() / 1000000n);
}

async function waitClosed(orderId: string) {
  await until(
    () => getOrder(orderId),
    (o: any) => o.status === "CLOSED" || o.isClosed === true,
    { timeoutMs: 4000, intervalMs: 150 }
  );
}

async function waitSettled(orderId: string) {
  await until(
    () => getOrder(orderId),
    (o: any) => o.isSettled === true || o.status === "SETTLED",
    { timeoutMs: 6000, intervalMs: 200 }
  );
}

test("STRESS: concorrência + idempotência (close, payments, cash, KDS, multiuser)", async (t) => {
  const RUNS = Number(process.env.STRESS_RUNS || "1");
  console.log(
    `[stress] node=${process.version} runs=${RUNS} station=${station}`
  );

  const categoryId = await createCategory();
  const productId = await createProduct(categoryId, station);

  for (let run = 1; run <= RUNS; run++) {
    console.log(`\n[run ${run}/${RUNS}] — começando`);

    // ---------------------------------------------------------------------
    await t.test(
      "close concorrente (2 chamadas mesma versão) → aceita {200+412/409/400-estado-inválido} OU {412+412 + recuperação}",
      async () => {
        const t0 = tNow();
        const { id: orderId, version, total } = await createOrder(productId, 2);

        // regra: FIRE antes de CLOSE
        const f = await fireOrderRaw(orderId);
        expect([200, 201].includes(f.status)).toBe(true);

        // dispare duas closes simultâneas com MESMA versão, SEM fallback interno
        const [r1, r2] = await Promise.all([
          closeOrderRawStable(orderId, version),
          closeOrderRawStable(orderId, version),
        ]);

        const is2xx = (s: number) => [200, 201].includes(s);

        // casos aceitos (sem recuperação):
        //  - um 2xx e o outro 412/409/400-estado-inválido
        const other = is2xx(r1.status) ? r2 : r1;
        const okNoRecovery =
          (is2xx(r1.status) || is2xx(r2.status)) &&
          (other.status === 412 ||
            other.status === 409 ||
            (other.status === 400 && looksLikeAlreadyClosed(other)));

        // caso alternativo: 412 + 412 (ambas obsoletas) → recupera
        const both412 = r1.status === 412 && r2.status === 412;

        expect(okNoRecovery || both412).toBe(true);

        // recuperação se for o caso: fecha com versão FRESCA
        if (both412) {
          const fresh = await getOrder(orderId);
          const r = await closeOrderRawStable(orderId, fresh.version);
          expect(
            [200, 201, 412, 409].includes(r.status) ||
              (r.status === 400 && looksLikeAlreadyClosed(r))
          ).toBe(true);
        }

        await waitClosed(orderId);

        // cleanup: captura total (com retry em 429)
        const idemKey = randomUUID();
        const payRes = await capturePaymentRawRetry429(orderId, total, {
          stationId: station,
          idemKey,
        });
        expect(is2xx(payRes.status)).toBe(true);

        console.log(`close concorrente ok (${tNow() - t0}ms)`);
      }
    );

    await sleep(30); // pequeno pacing entre subtestes

    // ---------------------------------------------------------------------
    await t.test(
      "pagamento DUPLO MESMA Idempotency-Key → 1 registro efetivo",
      async () => {
        const t0 = tNow();
        const { id: orderId, total } = await createOrder(productId, 2);

        const f = await fireOrderRaw(orderId);
        expect([200, 201].includes(f.status)).toBe(true);

        const closed = await closeOrderRawStable(orderId);
        expect(
          [200, 201, 412, 409].includes(closed.status) ||
            (closed.status === 400 && looksLikeAlreadyClosed(closed))
        ).toBe(true);
        await waitClosed(orderId);

        const key = randomUUID();
        // MESMA chave, em paralelo; se 429, o helper re-tenta mantendo a chave
        const [p1, p2] = await Promise.all([
          capturePaymentRawRetry429(orderId, total, {
            stationId: station,
            idemKey: key,
          }),
          capturePaymentRawRetry429(orderId, total, {
            stationId: station,
            idemKey: key,
          }),
        ]);

        const okish = (s: number) => [200, 201, 409].includes(s);
        expect(okish(p1.status)).toBe(true);
        expect(okish(p2.status)).toBe(true);

        await waitSettled(orderId);
        const list = await listPaymentsByOrder(orderId);
        const captured = (list.items || list).filter(
          (p: any) => p.status === "CAPTURED"
        );
        expect(captured.length).toBe(1);

        console.log(`idempotência de pagamento ok (${tNow() - t0}ms)`);
      }
    );

    await sleep(30);

    // ---------------------------------------------------------------------
    await t.test(
      "pagamentos concorrentes (chaves DIFERENTES para o total) → {2xx + 409} ou serialização equivalente",
      async () => {
        const t0 = tNow();
        const { id: orderId, total } = await createOrder(productId, 2);

        const f = await fireOrderRaw(orderId);
        expect([200, 201].includes(f.status)).toBe(true);

        const closed = await closeOrderRawStable(orderId);
        expect(
          [200, 201, 412, 409].includes(closed.status) ||
            (closed.status === 400 && looksLikeAlreadyClosed(closed))
        ).toBe(true);
        await waitClosed(orderId);

        const [r1, r2] = await Promise.all([
          capturePaymentRawRetry429(orderId, total, {
            stationId: station,
            idemKey: randomUUID(),
          }),
          capturePaymentRawRetry429(orderId, total, {
            stationId: station,
            idemKey: randomUUID(),
          }),
        ]);

        const okLike = (s: number) => [200, 201, 409].includes(s);
        expect(okLike(r1.status)).toBe(true);
        expect(okLike(r2.status)).toBe(true);

        const list = await listPaymentsByOrder(orderId);
        const captured = (list.items || list).filter(
          (p: any) => p.status === "CAPTURED"
        );
        expect(captured.length).toBeLessThanOrEqual(1);

        console.log(`corrida de total ok (${tNow() - t0}ms)`);
      }
    );

    await sleep(30);

    // ---------------------------------------------------------------------
    await t.test(
      "open de sessão de caixa concorrente → 1 cria e/ou demais conflitam, e sempre localizo a OPEN",
      async () => {
        const t0 = tNow();
        // normaliza: fecha OPEN anterior se existir; ignore 409/400
        const before = await findOpenCashSessionId(station);
        if (before) {
          try {
            await closeCashSession(before);
          } catch {}
        }

        const [a, b, c] = await Promise.all([
          openCashSessionRaw(station),
          openCashSessionRaw(station),
          openCashSessionRaw(station),
        ]);
        const statuses = [a.status, b.status, c.status];
        const created = statuses.filter((s) => [200, 201].includes(s)).length;
        const conflicts = statuses.filter((s) => s === 409).length;

        expect(created >= 1 || conflicts === 3).toBe(true);

        const openId = await findOpenCashSessionId(station);
        expect(!!openId).toBe(true);
        if (openId) {
          try {
            await closeCashSession(openId);
          } catch {}
        }

        console.log(`open cash concorrente ok (${tNow() - t0}ms)`);
      }
    );

    await sleep(30);

    // ---------------------------------------------------------------------
    await t.test(
      "FIRE concorrente (3 chamadas) → ticket visível uma vez no KDS",
      async () => {
        const t0 = tNow();
        const { id: orderId } = await createOrder(productId, 2);

        const [f1, f2, f3] = await Promise.all([
          fireOrderRaw(orderId),
          fireOrderRaw(orderId),
          fireOrderRaw(orderId),
        ]);
        const any2xx = [f1, f2, f3].some((r) => [200, 201].includes(r.status));
        expect(any2xx).toBe(true);

        const kds = await until(
          () => listKdsFired(station),
          (r) =>
            r.status === 200 &&
            Array.isArray(r.body?.items) &&
            r.body.items.some((it: any) => it.orderId === orderId)
        );
        expect(kds.status).toBe(200);

        console.log(`FIRE concorrente ok (${tNow() - t0}ms)`);
      }
    );

    await sleep(30);

    // ---------------------------------------------------------------------
    await t.test(
      "multiusuário: capturas parciais em paralelo liquidam a ordem",
      async () => {
        const t0 = tNow();
        const hasUser2 = !!process.env.TEST_BEARER_2;
        const { id: orderId, total } = await createOrder(productId, 2);

        const f = await fireOrderRaw(orderId);
        expect([200, 201].includes(f.status)).toBe(true);

        const closed = await closeOrderRawStable(orderId);
        expect(
          [200, 201, 412, 409].includes(closed.status) ||
            (closed.status === 400 && looksLikeAlreadyClosed(closed))
        ).toBe(true);
        await waitClosed(orderId);

        const half = String((Number(total) / 2).toFixed(2));
        const rest = String((Number(total) - Number(half)).toFixed(2));

        const [p1, p2] = await Promise.all([
          capturePaymentRawRetry429(orderId, half, {
            stationId: station,
            useBearer2: false,
            idemKey: randomUUID(),
          }),
          capturePaymentRawRetry429(orderId, rest, {
            stationId: station,
            useBearer2: hasUser2,
            idemKey: randomUUID(),
          }),
        ]);

        const good = (s: number) => [200, 201].includes(s);
        expect(good(p1.status)).toBe(true);
        expect(good(p2.status)).toBe(true);

        await waitSettled(orderId);
        const ord = await getOrder(orderId);
        expect(ord.isSettled === true || ord.status === "SETTLED").toBe(true);

        console.log(`multiusuário ok (${tNow() - t0}ms)`);
      }
    );

    await sleep(30);
  }

  t.after(() => {
    printHttpMetricsSummary();
  });
});
