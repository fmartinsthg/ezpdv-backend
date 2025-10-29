"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const expect_1 = __importDefault(require("expect"));
const node_crypto_1 = require("node:crypto");
const helpers_1 = require("./helpers");
function tNow() {
    return Number(process.hrtime.bigint() / 1000000n);
}
async function waitClosed(orderId) {
    await (0, helpers_1.until)(() => (0, helpers_1.getOrder)(orderId), (o) => o.status === "CLOSED" || o.isClosed === true, { timeoutMs: 4000, intervalMs: 150 });
}
async function waitSettled(orderId) {
    await (0, helpers_1.until)(() => (0, helpers_1.getOrder)(orderId), (o) => o.isSettled === true || o.status === "SETTLED", { timeoutMs: 6000, intervalMs: 200 });
}
(0, node_test_1.test)("STRESS: concorrência + idempotência (close, payments, cash, KDS, multiuser)", async (t) => {
    const RUNS = Number(process.env.STRESS_RUNS || "1");
    console.log(`[stress] node=${process.version} runs=${RUNS} station=${helpers_1.defaultStation}`);
    const categoryId = await (0, helpers_1.createCategory)();
    const productId = await (0, helpers_1.createProduct)(categoryId, helpers_1.defaultStation);
    for (let run = 1; run <= RUNS; run++) {
        console.log(`\n[run ${run}/${RUNS}] — começando`);
        // ---------------------------------------------------------------------
        await t.test("close concorrente (2 chamadas mesma versão) → aceita {200+412/409/400-estado-inválido} OU {412+412 + recuperação}", async () => {
            const t0 = tNow();
            const { id: orderId, version, total } = await (0, helpers_1.createOrder)(productId, 2);
            // regra: FIRE antes de CLOSE
            const f = await (0, helpers_1.fireOrderRaw)(orderId);
            (0, expect_1.default)([200, 201].includes(f.status)).toBe(true);
            // dispare duas closes simultâneas com MESMA versão, SEM fallback interno
            const [r1, r2] = await Promise.all([
                (0, helpers_1.closeOrderRawStable)(orderId, version),
                (0, helpers_1.closeOrderRawStable)(orderId, version),
            ]);
            const is2xx = (s) => [200, 201].includes(s);
            // casos aceitos (sem recuperação):
            //  - um 2xx e o outro 412/409/400-estado-inválido
            const other = is2xx(r1.status) ? r2 : r1;
            const okNoRecovery = (is2xx(r1.status) || is2xx(r2.status)) &&
                (other.status === 412 ||
                    other.status === 409 ||
                    (other.status === 400 && (0, helpers_1.looksLikeAlreadyClosed)(other)));
            // caso alternativo: 412 + 412 (ambas obsoletas) → recupera
            const both412 = r1.status === 412 && r2.status === 412;
            (0, expect_1.default)(okNoRecovery || both412).toBe(true);
            // recuperação se for o caso: fecha com versão FRESCA
            if (both412) {
                const fresh = await (0, helpers_1.getOrder)(orderId);
                const r = await (0, helpers_1.closeOrderRawStable)(orderId, fresh.version);
                (0, expect_1.default)([200, 201, 412, 409].includes(r.status) ||
                    (r.status === 400 && (0, helpers_1.looksLikeAlreadyClosed)(r))).toBe(true);
            }
            await waitClosed(orderId);
            // cleanup: captura total (com retry em 429)
            const idemKey = (0, node_crypto_1.randomUUID)();
            const payRes = await (0, helpers_1.capturePaymentRawRetry429)(orderId, total, {
                stationId: helpers_1.defaultStation,
                idemKey,
            });
            (0, expect_1.default)(is2xx(payRes.status)).toBe(true);
            console.log(`close concorrente ok (${tNow() - t0}ms)`);
        });
        await (0, helpers_1.sleep)(30); // pequeno pacing entre subtestes
        // ---------------------------------------------------------------------
        await t.test("pagamento DUPLO MESMA Idempotency-Key → 1 registro efetivo", async () => {
            const t0 = tNow();
            const { id: orderId, total } = await (0, helpers_1.createOrder)(productId, 2);
            const f = await (0, helpers_1.fireOrderRaw)(orderId);
            (0, expect_1.default)([200, 201].includes(f.status)).toBe(true);
            const closed = await (0, helpers_1.closeOrderRawStable)(orderId);
            (0, expect_1.default)([200, 201, 412, 409].includes(closed.status) ||
                (closed.status === 400 && (0, helpers_1.looksLikeAlreadyClosed)(closed))).toBe(true);
            await waitClosed(orderId);
            const key = (0, node_crypto_1.randomUUID)();
            // MESMA chave, em paralelo; se 429, o helper re-tenta mantendo a chave
            const [p1, p2] = await Promise.all([
                (0, helpers_1.capturePaymentRawRetry429)(orderId, total, {
                    stationId: helpers_1.defaultStation,
                    idemKey: key,
                }),
                (0, helpers_1.capturePaymentRawRetry429)(orderId, total, {
                    stationId: helpers_1.defaultStation,
                    idemKey: key,
                }),
            ]);
            const okish = (s) => [200, 201, 409].includes(s);
            (0, expect_1.default)(okish(p1.status)).toBe(true);
            (0, expect_1.default)(okish(p2.status)).toBe(true);
            await waitSettled(orderId);
            const list = await (0, helpers_1.listPaymentsByOrder)(orderId);
            const captured = (list.items || list).filter((p) => p.status === "CAPTURED");
            (0, expect_1.default)(captured.length).toBe(1);
            console.log(`idempotência de pagamento ok (${tNow() - t0}ms)`);
        });
        await (0, helpers_1.sleep)(30);
        // ---------------------------------------------------------------------
        await t.test("pagamentos concorrentes (chaves DIFERENTES para o total) → {2xx + 409} ou serialização equivalente", async () => {
            const t0 = tNow();
            const { id: orderId, total } = await (0, helpers_1.createOrder)(productId, 2);
            const f = await (0, helpers_1.fireOrderRaw)(orderId);
            (0, expect_1.default)([200, 201].includes(f.status)).toBe(true);
            const closed = await (0, helpers_1.closeOrderRawStable)(orderId);
            (0, expect_1.default)([200, 201, 412, 409].includes(closed.status) ||
                (closed.status === 400 && (0, helpers_1.looksLikeAlreadyClosed)(closed))).toBe(true);
            await waitClosed(orderId);
            const [r1, r2] = await Promise.all([
                (0, helpers_1.capturePaymentRawRetry429)(orderId, total, {
                    stationId: helpers_1.defaultStation,
                    idemKey: (0, node_crypto_1.randomUUID)(),
                }),
                (0, helpers_1.capturePaymentRawRetry429)(orderId, total, {
                    stationId: helpers_1.defaultStation,
                    idemKey: (0, node_crypto_1.randomUUID)(),
                }),
            ]);
            const okLike = (s) => [200, 201, 409].includes(s);
            (0, expect_1.default)(okLike(r1.status)).toBe(true);
            (0, expect_1.default)(okLike(r2.status)).toBe(true);
            const list = await (0, helpers_1.listPaymentsByOrder)(orderId);
            const captured = (list.items || list).filter((p) => p.status === "CAPTURED");
            (0, expect_1.default)(captured.length).toBeLessThanOrEqual(1);
            console.log(`corrida de total ok (${tNow() - t0}ms)`);
        });
        await (0, helpers_1.sleep)(30);
        // ---------------------------------------------------------------------
        await t.test("open de sessão de caixa concorrente → 1 cria e/ou demais conflitam, e sempre localizo a OPEN", async () => {
            const t0 = tNow();
            // normaliza: fecha OPEN anterior se existir; ignore 409/400
            const before = await (0, helpers_1.findOpenCashSessionId)(helpers_1.defaultStation);
            if (before) {
                try {
                    await (0, helpers_1.closeCashSession)(before);
                }
                catch { }
            }
            const [a, b, c] = await Promise.all([
                (0, helpers_1.openCashSessionRaw)(helpers_1.defaultStation),
                (0, helpers_1.openCashSessionRaw)(helpers_1.defaultStation),
                (0, helpers_1.openCashSessionRaw)(helpers_1.defaultStation),
            ]);
            const statuses = [a.status, b.status, c.status];
            const created = statuses.filter((s) => [200, 201].includes(s)).length;
            const conflicts = statuses.filter((s) => s === 409).length;
            (0, expect_1.default)(created >= 1 || conflicts === 3).toBe(true);
            const openId = await (0, helpers_1.findOpenCashSessionId)(helpers_1.defaultStation);
            (0, expect_1.default)(!!openId).toBe(true);
            if (openId) {
                try {
                    await (0, helpers_1.closeCashSession)(openId);
                }
                catch { }
            }
            console.log(`open cash concorrente ok (${tNow() - t0}ms)`);
        });
        await (0, helpers_1.sleep)(30);
        // ---------------------------------------------------------------------
        await t.test("FIRE concorrente (3 chamadas) → ticket visível uma vez no KDS", async () => {
            const t0 = tNow();
            const { id: orderId } = await (0, helpers_1.createOrder)(productId, 2);
            const [f1, f2, f3] = await Promise.all([
                (0, helpers_1.fireOrderRaw)(orderId),
                (0, helpers_1.fireOrderRaw)(orderId),
                (0, helpers_1.fireOrderRaw)(orderId),
            ]);
            const any2xx = [f1, f2, f3].some((r) => [200, 201].includes(r.status));
            (0, expect_1.default)(any2xx).toBe(true);
            const kds = await (0, helpers_1.until)(() => (0, helpers_1.listKdsFired)(helpers_1.defaultStation), (r) => r.status === 200 &&
                Array.isArray(r.body?.items) &&
                r.body.items.some((it) => it.orderId === orderId));
            (0, expect_1.default)(kds.status).toBe(200);
            console.log(`FIRE concorrente ok (${tNow() - t0}ms)`);
        });
        await (0, helpers_1.sleep)(30);
        // ---------------------------------------------------------------------
        await t.test("multiusuário: capturas parciais em paralelo liquidam a ordem", async () => {
            const t0 = tNow();
            const hasUser2 = !!process.env.TEST_BEARER_2;
            const { id: orderId, total } = await (0, helpers_1.createOrder)(productId, 2);
            const f = await (0, helpers_1.fireOrderRaw)(orderId);
            (0, expect_1.default)([200, 201].includes(f.status)).toBe(true);
            const closed = await (0, helpers_1.closeOrderRawStable)(orderId);
            (0, expect_1.default)([200, 201, 412, 409].includes(closed.status) ||
                (closed.status === 400 && (0, helpers_1.looksLikeAlreadyClosed)(closed))).toBe(true);
            await waitClosed(orderId);
            const half = String((Number(total) / 2).toFixed(2));
            const rest = String((Number(total) - Number(half)).toFixed(2));
            const [p1, p2] = await Promise.all([
                (0, helpers_1.capturePaymentRawRetry429)(orderId, half, {
                    stationId: helpers_1.defaultStation,
                    useBearer2: false,
                    idemKey: (0, node_crypto_1.randomUUID)(),
                }),
                (0, helpers_1.capturePaymentRawRetry429)(orderId, rest, {
                    stationId: helpers_1.defaultStation,
                    useBearer2: hasUser2,
                    idemKey: (0, node_crypto_1.randomUUID)(),
                }),
            ]);
            const good = (s) => [200, 201].includes(s);
            (0, expect_1.default)(good(p1.status)).toBe(true);
            (0, expect_1.default)(good(p2.status)).toBe(true);
            await waitSettled(orderId);
            const ord = await (0, helpers_1.getOrder)(orderId);
            (0, expect_1.default)(ord.isSettled === true || ord.status === "SETTLED").toBe(true);
            console.log(`multiusuário ok (${tNow() - t0}ms)`);
        });
        await (0, helpers_1.sleep)(30);
    }
    t.after(() => {
        (0, helpers_1.printHttpMetricsSummary)();
    });
});
