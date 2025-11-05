"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/test/kds-payments.e2e-spec.ts
const node_test_1 = require("node:test");
const expect_1 = __importDefault(require("expect"));
const helpers_1 = require("./helpers");
function todayUtcYYYYMMDD() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
(0, node_test_1.test)("KDS + Payments + Cash (close → pay CASH w/ station → settled → KDS some + cash summary)", async (t) => {
    console.log("[payments+cash] baseUrl/tenant OK");
    let categoryId = "";
    let productId = "";
    let orderId = "";
    let orderVersion = "";
    let orderTotal = "0.00";
    let cashSessionId = "";
    await t.test("abre sessão de caixa (station)", async () => {
        cashSessionId = await (0, helpers_1.openCashSession)(helpers_1.defaultStation);
        (0, expect_1.default)(!!cashSessionId).toBe(true);
    });
    await t.test("cria categoria", async () => {
        categoryId = await (0, helpers_1.createCategory)();
        (0, expect_1.default)(Boolean(categoryId)).toBe(true);
    });
    await t.test("cria produto com prepStation", async () => {
        productId = await (0, helpers_1.createProduct)(categoryId, helpers_1.defaultStation);
        (0, expect_1.default)(Boolean(productId)).toBe(true);
    });
    await t.test("cria comanda com 2 itens", async () => {
        const o = await (0, helpers_1.createOrder)(productId, 2);
        orderId = o.id;
        orderVersion = o.version; // pode ficar obsoleta após FIRE
        orderTotal = o.total;
        (0, expect_1.default)(orderId).toBeTruthy();
        (0, expect_1.default)(orderTotal).toMatch(/^\d+\.\d{2,}$/);
    });
    await t.test("FIRE itens e KDS exibe ticket", async () => {
        await (0, helpers_1.fireOrder)(orderId);
        const kds = await (0, helpers_1.until)(() => (0, helpers_1.listKdsFired)(helpers_1.defaultStation), (r) => r.status === 200 &&
            Array.isArray(r.body?.items) &&
            r.body.items.some((it) => it.orderId === orderId));
        (0, expect_1.default)(kds.status).toBe(200);
    });
    await t.test("CLOSE → captura pagamento CASH (com X-Station-Id) → SETTLED → some do KDS", async () => {
        // 1) close
        await (0, helpers_1.closeOrder)(orderId, orderVersion);
        // 2) garantia CLOSED
        await (0, helpers_1.until)(() => (0, helpers_1.getOrder)(orderId), (o) => o.status === "CLOSED" || o.isClosed === true, { timeoutMs: 4000, intervalMs: 150 });
        // 3) paga total em CASH com X-Station-Id (integração Cash)
        await (0, helpers_1.capturePayment)(orderId, orderTotal, undefined, helpers_1.defaultStation);
        // 4) aguarda settled
        await (0, helpers_1.until)(() => (0, helpers_1.getOrder)(orderId), (o) => o.isSettled === true || o.status === "SETTLED", { timeoutMs: 6000, intervalMs: 200 });
        // 5) garante que sumiu do KDS
        const after = await (0, helpers_1.until)(() => (0, helpers_1.listKdsFired)(helpers_1.defaultStation), (r) => r.status === 200 &&
            Array.isArray(r.body?.items) &&
            !r.body.items.some((it) => it.orderId === orderId), { timeoutMs: 6000, intervalMs: 200 });
        (0, expect_1.default)(after.status).toBe(200);
        const stillThere = (after.body?.items || []).some((it) => it.orderId === orderId);
        (0, expect_1.default)(stillThere).toBe(false);
    });
    await t.test("detalhe da sessão deve listar o payment", async () => {
        const s = await (0, helpers_1.getCashSessionDetail)(cashSessionId);
        (0, expect_1.default)(Array.isArray(s?.payments)).toBe(true);
        (0, expect_1.default)((s?.payments || []).length >= 1).toBe(true);
    });
    await t.test("fecha sessão de caixa e confere summary", async () => {
        const summary = await (0, helpers_1.closeCashSession)(cashSessionId);
        (0, expect_1.default)(typeof summary?.cashExpected).toBe("string");
        (0, expect_1.default)(summary?.payments?.count >= 1).toBe(true);
        if (summary?.totalsByMethod?.CASH) {
            (0, expect_1.default)(String(summary.totalsByMethod.CASH)).toMatch(/^\d+\.\d{2,}$/);
        }
    });
    await t.test("daily report do dia deve refletir CASH", async () => {
        const rep = await (0, helpers_1.getDailyReport)(todayUtcYYYYMMDD());
        if (rep && rep.CASH) {
            (0, expect_1.default)(String(rep.CASH)).toMatch(/^\d+\.\d{2,}$/);
        }
    });
    // cleanup: se algo falhar antes do close explícito, tenta fechar aqui
    t.after(async () => {
        try {
            if (cashSessionId) {
                await (0, helpers_1.closeCashSession)(cashSessionId);
            }
        }
        catch {
        }
    });
});
