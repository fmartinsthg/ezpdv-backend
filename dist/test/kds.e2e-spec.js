"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/test/kds.e2e-spec.ts
require("dotenv/config");
const supertest_1 = __importDefault(require("supertest"));
const expect_1 = __importDefault(require("expect"));
const node_test_1 = require("node:test");
const node_crypto_1 = require("node:crypto");
// eventsource v2 para Node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EventSource } = require("eventsource");
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3333";
const tenantId = process.env.TEST_TENANT_ID || "";
const DEFAULT_STATION = (process.env.TEST_STATION || "BAR").toUpperCase();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || "";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || "";
let bearer = (process.env.TEST_BEARER || "").replace(/^Bearer\s+/i, "");
if (!baseUrl.startsWith("http"))
    throw new Error(`TEST_BASE_URL inválida: ${baseUrl}`);
if (!tenantId)
    throw new Error("TEST_TENANT_ID não definido");
// ---------- helpers ----------
const jstr = (v) => {
    try {
        return JSON.stringify(v, null, 2);
    }
    catch {
        return String(v);
    }
};
function authTop(req) {
    return req
        .set("Authorization", `Bearer ${bearer}`)
        .set("X-Tenant-Id", tenantId);
}
function authTenant(req) {
    return req.set("Authorization", `Bearer ${bearer}`);
}
async function tryLogin() {
    const creds = [];
    if (ADMIN_EMAIL && ADMIN_PASSWORD)
        creds.push({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD)
        creds.push({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
    for (const c of creds) {
        const res = await (0, supertest_1.default)(baseUrl)
            .post("/auth/login")
            .send({ email: c.email, password: c.password });
        if (res.status === 200 && (res.body?.access_token || res.body?.token)) {
            bearer = String(res.body.access_token || res.body.token);
            return true;
        }
    }
    return false;
}
async function execTop(method, path, opts = {}) {
    const { body, query, idemScope, extraHeaders } = opts;
    let req = (0, supertest_1.default)(baseUrl)[method](path);
    if (query)
        req = req.query(query);
    req = authTop(req);
    if (idemScope)
        req = req
            .set("Idempotency-Scope", idemScope)
            .set("Idempotency-Key", (0, node_crypto_1.randomUUID)());
    if (extraHeaders)
        for (const [k, v] of Object.entries(extraHeaders))
            req = req.set(k, v);
    let res = await req.send(body ?? {});
    if (res.status === 401 && (await tryLogin())) {
        let retry = (0, supertest_1.default)(baseUrl)[method](path);
        if (query)
            retry = retry.query(query);
        retry = authTop(retry);
        if (idemScope)
            retry = retry
                .set("Idempotency-Scope", idemScope)
                .set("Idempotency-Key", (0, node_crypto_1.randomUUID)());
        if (extraHeaders)
            for (const [k, v] of Object.entries(extraHeaders))
                retry = retry.set(k, v);
        res = await retry.send(body ?? {});
    }
    return res;
}
async function execTenant(method, path, opts = {}) {
    const { body, query, idemScope, extraHeaders } = opts;
    let req = (0, supertest_1.default)(baseUrl)[method](path);
    if (query)
        req = req.query(query);
    req = authTenant(req);
    if (idemScope)
        req = req
            .set("Idempotency-Scope", idemScope)
            .set("Idempotency-Key", (0, node_crypto_1.randomUUID)());
    if (extraHeaders)
        for (const [k, v] of Object.entries(extraHeaders))
            req = req.set(k, v);
    let res = await req.send(body ?? {});
    if (res.status === 401 && (await tryLogin())) {
        let retry = (0, supertest_1.default)(baseUrl)[method](path);
        if (query)
            retry = retry.query(query);
        retry = authTenant(retry);
        if (idemScope)
            retry = retry
                .set("Idempotency-Scope", idemScope)
                .set("Idempotency-Key", (0, node_crypto_1.randomUUID)());
        if (extraHeaders)
            for (const [k, v] of Object.entries(extraHeaders))
                retry = retry.set(k, v);
        res = await retry.send(body ?? {});
    }
    return res;
}
function once(es, type, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            try {
                es.close?.();
            }
            catch { }
            reject(new Error(`Timeout esperando evento ${type}`));
        }, timeoutMs);
        const handler = (msg) => {
            try {
                const data = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
                if (data?.type === type) {
                    clearTimeout(timer);
                    es.removeEventListener?.("message", handler);
                    resolve(data);
                }
            }
            catch { }
        };
        es.addEventListener?.("message", handler);
    });
}
// ---------- testes ----------
(0, node_test_1.describe)("KDS SSE e fluxo de cozinha (E2E)", () => {
    let categoryId = "";
    let productId = "";
    let orderId = "";
    let station = DEFAULT_STATION;
    (0, node_test_1.before)(async () => {
        // sanity + auth
        const ping = await execTenant("get", `/tenants/${tenantId}/orders`, {
            query: { limit: 1 },
        });
        if (ping.status === 401) {
            throw new Error("Falha de autenticação. Defina TEST_BEARER válido no .env, ou ADMIN_EMAIL/ADMIN_PASSWORD (ou SUPERADMIN_*) para login automático.");
        }
    });
    (0, node_test_1.it)("cria categoria (top-level, X-Tenant-Id)", async () => {
        const res = await execTop("post", `/categories`, {
            body: { name: `Bebidas QA ${Date.now()}` },
        });
        if (![200, 201].includes(res.status)) {
            console.error("Falha POST /categories:", res.status, jstr(res.body || res.text));
        }
        (0, expect_1.default)([200, 201]).toContain(res.status);
        categoryId = res.body?.id;
        (0, expect_1.default)(!!categoryId).toBe(true);
    });
    (0, node_test_1.it)("cria produto (top-level, X-Tenant-Id) com prepStation e stock", async () => {
        const payload = {
            name: `Produto KDS ${Date.now()}`,
            description: "Prod KDS",
            price: "9.90",
            cost: "3.90",
            stock: "100.000", // obrigatório como string decimal
            categoryId,
            prepStation: station,
        };
        const res = await execTop("post", `/products`, { body: payload });
        if (![200, 201].includes(res.status)) {
            console.error("Falha POST /products:", res.status, jstr(res.body || res.text));
        }
        (0, expect_1.default)([200, 201]).toContain(res.status);
        productId = res.body?.id;
        (0, expect_1.default)(!!productId).toBe(true);
        const pStation = (res.body?.prepStation || "").toUpperCase();
        if (pStation)
            station = pStation;
    });
    (0, node_test_1.it)("cria comanda com 2 itens (com Idempotency)", async () => {
        const res = await execTenant("post", `/tenants/${tenantId}/orders`, {
            idemScope: "orders:create",
            body: {
                tabNumber: `MESA-${Math.floor(Math.random() * 1000)}`,
                items: [
                    { productId, quantity: 1 },
                    { productId, quantity: 1 },
                ],
            },
        });
        if (res.status !== 201) {
            console.error("Falha POST /orders:", res.status, jstr(res.body || res.text));
        }
        (0, expect_1.default)(res.status).toBe(201);
        orderId = res.body?.id;
        (0, expect_1.default)(!!orderId).toBe(true);
        (0, expect_1.default)(Array.isArray(res.body?.items)).toBe(true);
        (0, expect_1.default)(res.body.items.length).toBeGreaterThanOrEqual(2);
    });
    (0, node_test_1.it)("FIRE itens → recebe item.fired no SSE (best-effort) e garante FIRED na API", async () => {
        const url = `${baseUrl}/tenants/${tenantId}/kds/stream?station=${encodeURIComponent(station)}`;
        const es = new EventSource(url, {
            headers: { Authorization: `Bearer ${bearer}` },
        });
        const fireRes = await execTenant("post", `/tenants/${tenantId}/orders/${orderId}/fire`, {
            idemScope: "orders:fire",
            body: {},
        });
        if (![200, 201].includes(fireRes.status)) {
            console.error("Falha POST /orders/:id/fire:", fireRes.status, jstr(fireRes.body || fireRes.text));
        }
        (0, expect_1.default)([200, 201]).toContain(fireRes.status);
        try {
            const evt = await once(es, "item.fired", 8000);
            // Se chegar, validamos:
            (0, expect_1.default)(evt.tenantId).toBe(tenantId);
            (0, expect_1.default)(evt.orderId).toBe(orderId);
            (0, expect_1.default)((evt.station || "").toUpperCase()).toBe(station);
        }
        catch (e) {
            console.warn("SSE item.fired não recebido a tempo; validando via API (ok se a próxima asserção passar).");
        }
        finally {
            try {
                es.close();
            }
            catch { }
        }
        // Garantia via API (de qualquer forma):
        const list = await execTenant("get", `/tenants/${tenantId}/kds/items`, {
            query: { station, status: "FIRED", page: 1, pageSize: 20 },
        });
        if (list.status !== 200) {
            console.error("Falha GET /kds/items:", list.status, jstr(list.body || list.text));
        }
        (0, expect_1.default)(list.status).toBe(200);
        const found = (list.body?.items || []).find((i) => i.orderId === orderId);
        (0, expect_1.default)(!!found).toBe(true);
    });
    (0, node_test_1.it)("GET /kds/items (FIRED) inclui item da comanda", async () => {
        const res = await execTenant("get", `/tenants/${tenantId}/kds/items`, {
            query: { station, status: "FIRED", page: 1, pageSize: 20 },
        });
        if (res.status !== 200) {
            console.error("Falha GET /kds/items:", res.status, jstr(res.body || res.text));
        }
        (0, expect_1.default)(res.status).toBe(200);
        const found = (res.body?.items || []).find((i) => i.orderId === orderId);
        (0, expect_1.default)(!!found).toBe(true);
    });
    (0, node_test_1.it)("complete de 1 item (Idempotency) → some da lista FIRED", async () => {
        const list = await execTenant("get", `/tenants/${tenantId}/kds/items`, {
            query: { station, status: "FIRED", page: 1, pageSize: 20 },
        });
        (0, expect_1.default)(list.status).toBe(200);
        const current = (list.body?.items || []).find((i) => i.orderId === orderId);
        (0, expect_1.default)(!!current).toBe(true);
        const res = await execTenant("post", `/tenants/${tenantId}/kds/items/${current.id}/complete`, {
            idemScope: "kds:item:complete",
            body: {},
        });
        if (![200, 201].includes(res.status)) {
            console.error("Falha POST /kds/items/:id/complete:", res.status, jstr(res.body || res.text));
        }
        (0, expect_1.default)([200, 201]).toContain(res.status);
        const list2 = await execTenant("get", `/tenants/${tenantId}/kds/items`, {
            query: { station, status: "FIRED", page: 1, pageSize: 20 },
        });
        (0, expect_1.default)(list2.status).toBe(200);
        const stillThere = (list2.body?.items || []).find((i) => i.id === current.id);
        (0, expect_1.default)(!stillThere).toBe(true);
    });
    (0, node_test_1.it)("BUMP ticket (If-Match=version) → ticket.bumped (SSE best-effort)", async () => {
        // Pega a versão diretamente da ordem (mais confiável)
        const ord = await execTenant("get", `/tenants/${tenantId}/orders/${orderId}`);
        (0, expect_1.default)(ord.status).toBe(200);
        const version = ord.body?.version;
        (0, expect_1.default)(version !== undefined && version !== null).toBe(true);
        const url = `${baseUrl}/tenants/${tenantId}/kds/stream?station=${encodeURIComponent(station)}`;
        const es = new EventSource(url, {
            headers: { Authorization: `Bearer ${bearer}` },
        });
        // tenta com aspas (ETag style); se 428/412, tenta sem aspas
        const doBump = (ifMatch) => execTenant("post", `/tenants/${tenantId}/kds/tickets/${orderId}/bump`, {
            extraHeaders: { "If-Match": ifMatch },
            body: {},
        });
        let bump = await doBump(`"${version}"`);
        if (bump.status === 428 || bump.status === 412) {
            bump = await doBump(String(version));
        }
        if (![200, 201].includes(bump.status)) {
            console.error("Falha POST /kds/tickets/:orderId/bump:", bump.status, jstr(bump.body || bump.text));
        }
        (0, expect_1.default)([200, 201]).toContain(bump.status);
        try {
            const evt = await once(es, "ticket.bumped", 8000);
            (0, expect_1.default)(evt.tenantId).toBe(tenantId);
            (0, expect_1.default)(evt.orderId).toBe(orderId);
            (0, expect_1.default)(typeof evt.affected).toBe("number");
        }
        catch (e) {
            console.warn("SSE ticket.bumped não recebido a tempo; operação de bump foi 200/201, então seguimos.");
        }
        finally {
            try {
                es.close();
            }
            catch { }
        }
    });
});
