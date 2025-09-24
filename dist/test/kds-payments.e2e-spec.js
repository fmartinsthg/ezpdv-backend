"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/test/kds-payments.e2e-spec.ts
const node_test_1 = require("node:test");
const expect_1 = __importDefault(require("expect"));
const helpers_1 = require("./helpers");
(0, node_test_1.test)("KDS + Pagamentos (fluxo completo: close → pay → settled → some do KDS)", async (t) => {
    console.log("[payments-v4] baseUrl/tenant loaded OK");
    let categoryId = "";
    let productId = "";
    let orderId = "";
    let orderVersion = "";
    let orderTotal = "0.00";
    await t.test("cria categoria (top-level, X-Tenant-Id)", async () => {
        categoryId = await (0, helpers_1.createCategory)();
        console.log("✓ categoria criada", categoryId);
        (0, expect_1.default)(Boolean(categoryId)).toBe(true);
    });
    await t.test("cria produto (top-level, X-Tenant-Id) com prepStation e stock", async () => {
        productId = await (0, helpers_1.createProduct)(categoryId, helpers_1.defaultStation);
        console.log("✓ produto criado", productId);
        (0, expect_1.default)(Boolean(productId)).toBe(true);
    });
    await t.test("cria comanda com 2 itens (idempotência)", async () => {
        const o = await (0, helpers_1.createOrder)(productId, 2);
        orderId = o.id;
        orderVersion = o.version; // pode ficar desatualizada depois do FIRE
        orderTotal = o.total;
        console.log("✓ comanda criada", { orderId, orderTotal });
        (0, expect_1.default)(orderId).toBeTruthy();
        (0, expect_1.default)(orderTotal).toMatch(/^\d+\.\d{2,}$/);
    });
    await t.test("FIRE itens (idempotência) e garante FIRED no KDS", async () => {
        await (0, helpers_1.fireOrder)(orderId);
        const kds = await (0, helpers_1.until)(() => (0, helpers_1.listKdsFired)(helpers_1.defaultStation), (r) => r.status === 200 &&
            Array.isArray(r.body?.items) &&
            r.body.items.some((it) => it.orderId === orderId));
        (0, expect_1.default)(kds.status).toBe(200);
        const firedFromOrder = (kds.body?.items || []).filter((it) => it.orderId === orderId);
        (0, expect_1.default)(firedFromOrder.length > 0).toBe(true);
        console.log("✓ FIRE refletido no KDS");
    });
    await t.test("fecha pedido (orders:close) → some do KDS; depois captura pagamento (valor total)", async () => {
        console.log(">>> iniciando CLOSE (If-Match) + PAY + settled + verificação no KDS");
        // 1) CLOSE (helpers tratam 412 e timeouts)
        await (0, helpers_1.closeOrder)(orderId, orderVersion);
        console.log("✓ order CLOSED");
        // 2) Confirma CLOSED (evita race)
        await (0, helpers_1.until)(() => (0, helpers_1.getOrder)(orderId), (o) => o.status === "CLOSED" || o.isClosed === true, { timeoutMs: 4000, intervalMs: 150 });
        // 3) Paga o total (helpers alternam escopo e aplicam timeout)
        await (0, helpers_1.capturePayment)(orderId, orderTotal);
        console.log("✓ payment CAPTURED");
        // 4) Aguarda isSettled / SETTLED (se seu domínio sinaliza isso)
        await (0, helpers_1.until)(() => (0, helpers_1.getOrder)(orderId), (o) => o.isSettled === true || o.status === "SETTLED", { timeoutMs: 5000, intervalMs: 150 });
        console.log("✓ order SETTLED");
        // 5) Garante que sumiu do KDS
        const after = await (0, helpers_1.until)(() => (0, helpers_1.listKdsFired)(helpers_1.defaultStation), (r) => r.status === 200 &&
            Array.isArray(r.body?.items) &&
            !r.body.items.some((it) => it.orderId === orderId), { timeoutMs: 6000, intervalMs: 200 });
        (0, expect_1.default)(after.status).toBe(200);
        const stillThere = (after.body?.items || []).some((it) => it.orderId === orderId);
        (0, expect_1.default)(stillThere).toBe(false);
        console.log("✓ KDS sem itens da comanda após pagamento/settled");
        console.log(">>> CLOSE + PAY + settled + KDS OK");
    });
});
