"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IFMATCH_QUOTES = exports.REQUIRE_SCOPE_DEFAULT = exports.PAYMENT_SCOPE = exports.idem = exports.authH = exports.api = exports.defaultStation = exports.bearer = exports.tenantId = exports.baseUrl = void 0;
exports.until = until;
exports.createCategory = createCategory;
exports.createProduct = createProduct;
exports.createOrder = createOrder;
exports.fireOrder = fireOrder;
exports.listKdsFired = listKdsFired;
exports.getOrder = getOrder;
exports.closeOrder = closeOrder;
exports.capturePayment = capturePayment;
exports.findOpenCashSessionId = findOpenCashSessionId;
exports.openCashSession = openCashSession;
exports.createCashMovement = createCashMovement;
exports.createCashCount = createCashCount;
exports.getCashSessionDetail = getCashSessionDetail;
exports.closeCashSession = closeCashSession;
exports.getDailyReport = getDailyReport;
// src/test/helpers.ts
require("dotenv/config");
const supertest_1 = __importDefault(require("supertest"));
const node_crypto_1 = require("node:crypto");
exports.baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3333";
exports.tenantId = process.env.TEST_TENANT_ID;
exports.bearer = process.env.TEST_BEARER;
exports.defaultStation = (process.env.TEST_STATION || "BAR").toUpperCase();
if (!exports.tenantId)
    throw new Error("TEST_TENANT_ID não definido");
if (!exports.bearer)
    throw new Error("TEST_BEARER não definido");
exports.api = (0, supertest_1.default)(exports.baseUrl);
exports.authH = { Authorization: `Bearer ${exports.bearer}` };
const idem = (scope) => ({
    "Idempotency-Scope": scope,
    "Idempotency-Key": (0, node_crypto_1.randomUUID)(),
});
exports.idem = idem;
exports.PAYMENT_SCOPE = process.env.TEST_PAYMENT_SCOPE || "orders:payments:capture";
// “palpite” inicial: tentar COM escopo (true) ou SEM escopo (false).
exports.REQUIRE_SCOPE_DEFAULT = (process.env.TEST_REQUIRE_SCOPE ?? "true").toLowerCase() !== "false";
exports.IFMATCH_QUOTES = (process.env.TEST_IFMATCH_QUOTES ?? "false").toLowerCase() === "true";
const DEBUG = (process.env.TEST_DEBUG ?? "").toLowerCase() === "true";
// --- util: retry em erros de rede transitórios -----------------------------
function isTransientNetError(err) {
    const code = err?.code || err?.errno;
    return (code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT");
}
async function withNetRetry(fn, attempts = 2) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        }
        catch (err) {
            lastErr = err;
            if (!isTransientNetError(err))
                throw err;
            if (i === attempts - 1)
                throw err;
            await new Promise((r) => setTimeout(r, 150)); // pequeno backoff
        }
    }
    throw lastErr;
}
// ---------------------------------------------------------------------------
async function until(fn, ok, { timeoutMs = 8000, intervalMs = 200, } = {}) {
    const t0 = Date.now();
    let last;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        last = await fn();
        if (ok(last))
            return last;
        if (Date.now() - t0 > timeoutMs)
            return last;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
}
// ---------------- Catalog (top-level + X-Tenant-Id) ------------------------
async function createCategory() {
    const body = {
        name: `E2E Cat ${Date.now()}`,
        description: "Categoria para E2E pagamentos",
    };
    const res = await withNetRetry(() => exports.api
        .post("/categories")
        .set(exports.authH)
        .set("X-Tenant-Id", exports.tenantId)
        .set("Accept", "application/json")
        .send(body));
    if (![200, 201].includes(res.status)) {
        console.error("Falha POST /categories:", res.status, JSON.stringify(res.body, null, 2));
        console.error("Payload enviado /categories:", JSON.stringify(body, null, 2));
    }
    if (!res.body?.id)
        throw new Error(`Categoria não criada: HTTP ${res.status}`);
    return String(res.body.id);
}
async function createProduct(categoryId, station = exports.defaultStation) {
    const body = {
        name: `E2E Prod ${Date.now()}`,
        description: "Produto para E2E pagamentos",
        price: "12.90",
        cost: "6.00",
        stock: "100.000", // string decimal
        categoryId,
        prepStation: station,
    };
    const res = await withNetRetry(() => exports.api
        .post("/products")
        .set(exports.authH)
        .set("X-Tenant-Id", exports.tenantId)
        .set("Accept", "application/json")
        .send(body));
    if (![200, 201].includes(res.status)) {
        console.error("Falha POST /products:", res.status, JSON.stringify(res.body, null, 2));
        console.error("Payload enviado /products:", JSON.stringify(body, null, 2));
    }
    if (!res.body?.id)
        throw new Error(`Produto não criado: HTTP ${res.status}`);
    return String(res.body.id);
}
// ---------------- Orders (tenant path) -------------------------------------
async function createOrder(productId, qty = 2) {
    const res = await withNetRetry(() => exports.api
        .post(`/tenants/${exports.tenantId}/orders`)
        .set(exports.authH)
        .set((0, exports.idem)("orders:create"))
        .set("Accept", "application/json")
        .send({
        tabNumber: `E2E-PAY-${Date.now()}`,
        items: [{ productId, quantity: qty }],
    }));
    if (res.status !== 201) {
        console.error("Falha POST /orders:", res.status, res.body);
        throw new Error(`Order não criada: HTTP ${res.status}`);
    }
    const id = String(res.body?.id ?? "");
    const version = String(res.body?.version ?? "");
    if (!id)
        throw new Error("Order sem id");
    const get = await withNetRetry(() => exports.api
        .get(`/tenants/${exports.tenantId}/orders/${id}`)
        .set(exports.authH)
        .set("Accept", "application/json"));
    if (get.status !== 200)
        throw new Error(`GET order falhou: HTTP ${get.status}`);
    const total = String(get.body?.total ?? "0.00");
    return { id, version, total };
}
async function fireOrder(orderId) {
    const res = await withNetRetry(() => exports.api
        .post(`/tenants/${exports.tenantId}/orders/${orderId}/fire`)
        .set(exports.authH)
        .set((0, exports.idem)("orders:fire"))
        .set("Accept", "application/json")
        .send({}));
    if (![200, 201].includes(res.status)) {
        console.error("Falha POST /orders/:id/fire:", res.status, res.body);
        throw new Error(`Fire falhou: HTTP ${res.status}`);
    }
}
async function listKdsFired(station = exports.defaultStation) {
    return withNetRetry(() => exports.api
        .get(`/tenants/${exports.tenantId}/kds/items`)
        .query({ station, status: "FIRED", page: 1, pageSize: 50 })
        .set(exports.authH)
        .set("Accept", "application/json"));
}
async function getOrder(orderId) {
    const res = await withNetRetry(() => exports.api
        .get(`/tenants/${exports.tenantId}/orders/${orderId}`)
        .set(exports.authH)
        .set("Accept", "application/json"));
    if (res.status !== 200) {
        console.error("Falha GET /orders/:id:", res.status, res.body);
        throw new Error(`GET order falhou: HTTP ${res.status}`);
    }
    return res.body; // { id, version, total, isSettled?, ... }
}
async function closeOrder(orderId, version) {
    const getCurVersion = async () => (await getOrder(orderId)).version;
    const doClose = async (v, quoted) => {
        const etag = quoted ? `"${v}"` : String(v);
        if (DEBUG)
            console.log(`→ CLOSE If-Match: ${etag}`);
        return exports.api
            .post(`/tenants/${exports.tenantId}/orders/${orderId}/close`)
            .set(exports.authH)
            .set((0, exports.idem)("orders:close"))
            .set("Accept", "application/json")
            .set("Connection", "close")
            .set("If-Match", etag)
            .send({});
    };
    let v = version ?? (await getCurVersion());
    let quoted = exports.IFMATCH_QUOTES;
    let res = await withNetRetry(() => doClose(v, quoted));
    if (res.status === 412) {
        if (DEBUG)
            console.log("↻ CLOSE retry com versão fresca:", await getCurVersion());
        v = await getCurVersion();
        res = await withNetRetry(() => doClose(v, quoted));
    }
    if (![200, 201].includes(res.status)) {
        console.error("Falha POST /orders/:id/close:", res.status, res.body);
        throw new Error(`Close falhou: HTTP ${res.status}`);
    }
    return { version: res.body?.version };
}
// ---------------- Payments (com station opcional) --------------------------
/**
 * Captura pagamento em CASH por padrão.
 * Assinatura preservada: (orderId, amount, idemKey?) e
 * foi adicionado o 4º parâmetro opcional stationId para enviar X-Station-Id.
 */
async function capturePayment(orderId, amount, idemKey, stationId) {
    const policy = (process.env.TEST_PAYMENT_SCOPE_POLICY ?? "auto").toLowerCase();
    const firstWithScope = policy === "required"
        ? true
        : policy === "forbidden"
            ? false
            : exports.REQUIRE_SCOPE_DEFAULT;
    const tryOnce = async (withScope, key) => {
        let req = exports.api
            .post(`/tenants/${exports.tenantId}/orders/${orderId}/payments`)
            .set(exports.authH)
            .set("Idempotency-Key", key)
            .set("Accept", "application/json")
            .set("Connection", "close")
            .send({ orderId, method: "CASH", amount, provider: "NULL" });
        if (withScope)
            req = req.set("Idempotency-Scope", exports.PAYMENT_SCOPE);
        if (stationId)
            req = req.set("X-Station-Id", stationId);
        if (DEBUG)
            console.log(`→ PAY (scope=${withScope ? "ON" : "OFF"}, key=${key.slice(0, 8)}, station=${stationId ?? "-"})`);
        const res = await withNetRetry(() => req);
        if (DEBUG)
            console.log("← PAY status:", res.status, "body:", JSON.stringify(res.body, null, 2));
        return res;
    };
    // 1ª tentativa
    const key1 = idemKey ?? (0, node_crypto_1.randomUUID)();
    let res = await tryOnce(firstWithScope, key1);
    // Se não for 400 ou se a política for fixa (required/forbidden), encerra
    if (res.status !== 400 || policy !== "auto") {
        if (![200, 201].includes(res.status)) {
            console.error("Falha POST /payments:", res.status, res.body);
            throw new Error(`Pagamento falhou: HTTP ${res.status}`);
        }
        return;
    }
    // Análise da mensagem para decidir fallback
    const msg = typeof res.body?.message === "string"
        ? res.body.message
        : JSON.stringify(res.body?.message ?? "");
    const saysForbidden = /Escopo de idempot[êe]ncia n[ãa]o permitido/i.test(msg);
    const saysRequired = /Idempotency-Scope .* obrigat[óo]rio/i.test(msg);
    let doFallback = false;
    let nextWithScope = firstWithScope;
    if (saysForbidden && firstWithScope) {
        if (DEBUG)
            console.log("↻ PAY fallback: removendo scope (FORBIDDEN detectado)");
        nextWithScope = false;
        doFallback = true;
    }
    else if (saysRequired && !firstWithScope) {
        if (DEBUG)
            console.log("↻ PAY fallback: adicionando scope (REQUIRED)");
        nextWithScope = true;
        doFallback = true;
    }
    if (!doFallback) {
        console.error("Falha POST /payments (sem fallback aplicável):", res.status, res.body);
        throw new Error(`Pagamento falhou: HTTP ${res.status}`);
    }
    // 2ª tentativa com **novo** Idempotency-Key
    const key2 = (0, node_crypto_1.randomUUID)();
    res = await tryOnce(nextWithScope, key2);
    if (![200, 201].includes(res.status)) {
        console.error("Falha POST /payments (fallback):", res.status, res.body);
        throw new Error(`Pagamento falhou: HTTP ${res.status}`);
    }
}
// ---------------- Cash (novo) ----------------------------------------------
/** Localiza uma sessão OPEN para a estação (via listagem). */
async function findOpenCashSessionId(stationId) {
    const res = await withNetRetry(() => exports.api
        .get(`/tenants/${exports.tenantId}/cash/sessions`)
        .query({ status: "OPEN", stationId, page: 1, pageSize: 1 })
        .set(exports.authH)
        .set("Accept", "application/json"));
    if (res.status !== 200)
        return null;
    const id = res.body?.items?.[0]?.id;
    return id ? String(id) : null;
}
/**
 * Abre sessão se não existir; se já existir (409), reaproveita a OPEN.
 * Mantém o nome exportado openCashSession para não quebrar quem usa.
 */
async function openCashSession(stationId) {
    const res = await withNetRetry(() => exports.api
        .post(`/tenants/${exports.tenantId}/cash/sessions/open`)
        .set(exports.authH)
        .set((0, exports.idem)("cash:open"))
        .set("Accept", "application/json")
        .send({
        stationId,
        openingFloat: { CASH: "150.00" },
        notes: "e2e open",
    }));
    if ([200, 201].includes(res.status)) {
        const id = String(res.body?.id ?? "");
        if (!id)
            throw new Error("Open cash retornou sem id");
        return id;
    }
    // 409 = já existe OPEN → localizar e retornar
    if (res.status === 409) {
        const openId = await findOpenCashSessionId(stationId);
        if (!openId)
            throw new Error("Já existe sessão OPEN, mas não consegui localizar o id (listagem vazia)");
        return openId;
    }
    console.error("Falha POST /cash/sessions/open:", res.status, JSON.stringify(res.body, null, 2));
    throw new Error(`Open cash falhou: HTTP ${res.status}`);
}
async function createCashMovement(sessionId, type, amount, reason) {
    const res = await withNetRetry(() => exports.api
        .post(`/tenants/${exports.tenantId}/cash/sessions/${sessionId}/movements`)
        .set(exports.authH)
        .set((0, exports.idem)("cash:movement"))
        .set("Accept", "application/json")
        .send({ type, method: "CASH", amount, reason }));
    if (![200, 201].includes(res.status)) {
        console.error("Falha POST cash movement:", res.status, res.body);
        throw new Error(`Movement falhou: HTTP ${res.status}`);
    }
}
async function createCashCount(sessionId, kind, total, denominations = {}) {
    const res = await withNetRetry(() => exports.api
        .post(`/tenants/${exports.tenantId}/cash/sessions/${sessionId}/counts`)
        .set(exports.authH)
        .set((0, exports.idem)("cash:count"))
        .set("Accept", "application/json")
        .send({ kind, total, denominations }));
    if (![200, 201].includes(res.status)) {
        console.error("Falha POST cash count:", res.status, res.body);
        throw new Error(`Count falhou: HTTP ${res.status}`);
    }
}
async function getCashSessionDetail(sessionId) {
    const res = await withNetRetry(() => exports.api
        .get(`/tenants/${exports.tenantId}/cash/sessions/${sessionId}`)
        .set(exports.authH)
        .set("Accept", "application/json"));
    if (res.status !== 200) {
        console.error("Falha GET cash session:", res.status, res.body);
        throw new Error(`GET cash session falhou: HTTP ${res.status}`);
    }
    return res.body;
}
async function closeCashSession(sessionId) {
    const res = await withNetRetry(() => exports.api
        .post(`/tenants/${exports.tenantId}/cash/sessions/${sessionId}/close`)
        .set(exports.authH)
        .set((0, exports.idem)("cash:close"))
        .set("Accept", "application/json")
        .send({ note: "e2e close" }));
    if (![200, 201].includes(res.status)) {
        console.error("Falha POST cash close:", res.status, res.body);
        throw new Error(`Close cash falhou: HTTP ${res.status}`);
    }
    return res.body; // summary
}
async function getDailyReport(dateISO /* yyyy-MM-dd */) {
    const res = await withNetRetry(() => exports.api
        .get(`/tenants/${exports.tenantId}/cash/reports/daily`)
        .query({ date: dateISO })
        .set(exports.authH)
        .set("Accept", "application/json"));
    if (res.status !== 200) {
        console.error("Falha GET cash daily report:", res.status, res.body);
        throw new Error(`Daily report falhou: HTTP ${res.status}`);
    }
    return res.body; // { CASH?: "..." , ... }
}
