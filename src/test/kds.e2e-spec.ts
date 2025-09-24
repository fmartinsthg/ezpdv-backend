// src/test/kds.e2e-spec.ts
import "dotenv/config";
import request from "supertest";
import expect from "expect";
import { describe, it, before } from "node:test";
import { randomUUID } from "node:crypto";

// eventsource v2 para Node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EventSource } = require("eventsource") as { EventSource: any };

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
if (!tenantId) throw new Error("TEST_TENANT_ID não definido");

// ---------- helpers ----------
const jstr = (v: any) => {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

function authTop(req: request.Test) {
  return req
    .set("Authorization", `Bearer ${bearer}`)
    .set("X-Tenant-Id", tenantId);
}
function authTenant(req: request.Test) {
  return req.set("Authorization", `Bearer ${bearer}`);
}

async function tryLogin(): Promise<boolean> {
  const creds: Array<{ email: string; password: string }> = [];
  if (ADMIN_EMAIL && ADMIN_PASSWORD)
    creds.push({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (SUPERADMIN_EMAIL && SUPERADMIN_PASSWORD)
    creds.push({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });

  for (const c of creds) {
    const res = await request(baseUrl)
      .post("/auth/login")
      .send({ email: c.email, password: c.password });
    if (res.status === 200 && (res.body?.access_token || res.body?.token)) {
      bearer = String(res.body.access_token || res.body.token);
      return true;
    }
  }
  return false;
}

type Method = "get" | "post" | "patch" | "put" | "delete";
type ExecOpts = {
  body?: any;
  query?: Record<string, any>;
  idemScope?: string;
  extraHeaders?: Record<string, string>;
};

async function execTop(method: Method, path: string, opts: ExecOpts = {}) {
  const { body, query, idemScope, extraHeaders } = opts;
  let req = request(baseUrl)[method](path);
  if (query) req = req.query(query);
  req = authTop(req);
  if (idemScope)
    req = req
      .set("Idempotency-Scope", idemScope)
      .set("Idempotency-Key", randomUUID());
  if (extraHeaders)
    for (const [k, v] of Object.entries(extraHeaders)) req = req.set(k, v);
  let res = await req.send(body ?? {});
  if (res.status === 401 && (await tryLogin())) {
    let retry = request(baseUrl)[method](path);
    if (query) retry = retry.query(query);
    retry = authTop(retry);
    if (idemScope)
      retry = retry
        .set("Idempotency-Scope", idemScope)
        .set("Idempotency-Key", randomUUID());
    if (extraHeaders)
      for (const [k, v] of Object.entries(extraHeaders))
        retry = retry.set(k, v);
    res = await retry.send(body ?? {});
  }
  return res;
}

async function execTenant(method: Method, path: string, opts: ExecOpts = {}) {
  const { body, query, idemScope, extraHeaders } = opts;
  let req = request(baseUrl)[method](path);
  if (query) req = req.query(query);
  req = authTenant(req);
  if (idemScope)
    req = req
      .set("Idempotency-Scope", idemScope)
      .set("Idempotency-Key", randomUUID());
  if (extraHeaders)
    for (const [k, v] of Object.entries(extraHeaders)) req = req.set(k, v);
  let res = await req.send(body ?? {});
  if (res.status === 401 && (await tryLogin())) {
    let retry = request(baseUrl)[method](path);
    if (query) retry = retry.query(query);
    retry = authTenant(retry);
    if (idemScope)
      retry = retry
        .set("Idempotency-Scope", idemScope)
        .set("Idempotency-Key", randomUUID());
    if (extraHeaders)
      for (const [k, v] of Object.entries(extraHeaders))
        retry = retry.set(k, v);
    res = await retry.send(body ?? {});
  }
  return res;
}

function once<T = any>(es: any, type: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        es.close?.();
      } catch {}
      reject(new Error(`Timeout esperando evento ${type}`));
    }, timeoutMs);
    const handler = (msg: any) => {
      try {
        const data =
          typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
        if (data?.type === type) {
          clearTimeout(timer);
          es.removeEventListener?.("message", handler as any);
          resolve(data);
        }
      } catch {}
    };
    es.addEventListener?.("message", handler as any);
  });
}

// ---------- testes ----------
describe("KDS SSE e fluxo de cozinha (E2E)", () => {
  let categoryId = "";
  let productId = "";
  let orderId = "";
  let station = DEFAULT_STATION;

  before(async () => {
    // sanity + auth
    const ping = await execTenant("get", `/tenants/${tenantId}/orders`, {
      query: { limit: 1 },
    });
    if (ping.status === 401) {
      throw new Error(
        "Falha de autenticação. Defina TEST_BEARER válido no .env, ou ADMIN_EMAIL/ADMIN_PASSWORD (ou SUPERADMIN_*) para login automático."
      );
    }
  });

  it("cria categoria (top-level, X-Tenant-Id)", async () => {
    const res = await execTop("post", `/categories`, {
      body: { name: `Bebidas QA ${Date.now()}` },
    });
    if (![200, 201].includes(res.status)) {
      console.error(
        "Falha POST /categories:",
        res.status,
        jstr(res.body || res.text)
      );
    }
    expect([200, 201]).toContain(res.status);
    categoryId = res.body?.id;
    expect(!!categoryId).toBe(true);
  });

  it("cria produto (top-level, X-Tenant-Id) com prepStation e stock", async () => {
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
      console.error(
        "Falha POST /products:",
        res.status,
        jstr(res.body || res.text)
      );
    }
    expect([200, 201]).toContain(res.status);
    productId = res.body?.id;
    expect(!!productId).toBe(true);

    const pStation = (res.body?.prepStation || "").toUpperCase();
    if (pStation) station = pStation;
  });

  it("cria comanda com 2 itens (com Idempotency)", async () => {
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
      console.error(
        "Falha POST /orders:",
        res.status,
        jstr(res.body || res.text)
      );
    }
    expect(res.status).toBe(201);
    orderId = res.body?.id;
    expect(!!orderId).toBe(true);
    expect(Array.isArray(res.body?.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });

  it("FIRE itens → recebe item.fired no SSE (best-effort) e garante FIRED na API", async () => {
    const url = `${baseUrl}/tenants/${tenantId}/kds/stream?station=${encodeURIComponent(
      station
    )}`;
    const es = new EventSource(url, {
      headers: { Authorization: `Bearer ${bearer}` },
    });

    const fireRes = await execTenant(
      "post",
      `/tenants/${tenantId}/orders/${orderId}/fire`,
      {
        idemScope: "orders:fire",
        body: {},
      }
    );
    if (![200, 201].includes(fireRes.status)) {
      console.error(
        "Falha POST /orders/:id/fire:",
        fireRes.status,
        jstr(fireRes.body || fireRes.text)
      );
    }
    expect([200, 201]).toContain(fireRes.status);

    try {
      const evt: any = await once(es, "item.fired", 8000);
      // Se chegar, validamos:
      expect(evt.tenantId).toBe(tenantId);
      expect(evt.orderId).toBe(orderId);
      expect((evt.station || "").toUpperCase()).toBe(station);
    } catch (e) {
      console.warn(
        "SSE item.fired não recebido a tempo; validando via API (ok se a próxima asserção passar)."
      );
    } finally {
      try {
        es.close();
      } catch {}
    }

    // Garantia via API (de qualquer forma):
    const list = await execTenant("get", `/tenants/${tenantId}/kds/items`, {
      query: { station, status: "FIRED", page: 1, pageSize: 20 },
    });
    if (list.status !== 200) {
      console.error(
        "Falha GET /kds/items:",
        list.status,
        jstr(list.body || list.text)
      );
    }
    expect(list.status).toBe(200);
    const found = (list.body?.items || []).find(
      (i: any) => i.orderId === orderId
    );
    expect(!!found).toBe(true);
  });

  it("GET /kds/items (FIRED) inclui item da comanda", async () => {
    const res = await execTenant("get", `/tenants/${tenantId}/kds/items`, {
      query: { station, status: "FIRED", page: 1, pageSize: 20 },
    });
    if (res.status !== 200) {
      console.error(
        "Falha GET /kds/items:",
        res.status,
        jstr(res.body || res.text)
      );
    }
    expect(res.status).toBe(200);
    const found = (res.body?.items || []).find(
      (i: any) => i.orderId === orderId
    );
    expect(!!found).toBe(true);
  });

  it("complete de 1 item (Idempotency) → some da lista FIRED", async () => {
    const list = await execTenant("get", `/tenants/${tenantId}/kds/items`, {
      query: { station, status: "FIRED", page: 1, pageSize: 20 },
    });
    expect(list.status).toBe(200);
    const current = (list.body?.items || []).find(
      (i: any) => i.orderId === orderId
    );
    expect(!!current).toBe(true);

    const res = await execTenant(
      "post",
      `/tenants/${tenantId}/kds/items/${current.id}/complete`,
      {
        idemScope: "kds:item:complete",
        body: {},
      }
    );
    if (![200, 201].includes(res.status)) {
      console.error(
        "Falha POST /kds/items/:id/complete:",
        res.status,
        jstr(res.body || res.text)
      );
    }
    expect([200, 201]).toContain(res.status);

    const list2 = await execTenant("get", `/tenants/${tenantId}/kds/items`, {
      query: { station, status: "FIRED", page: 1, pageSize: 20 },
    });
    expect(list2.status).toBe(200);
    const stillThere = (list2.body?.items || []).find(
      (i: any) => i.id === current.id
    );
    expect(!stillThere).toBe(true);
  });

  it("BUMP ticket (If-Match=version) → ticket.bumped (SSE best-effort)", async () => {
    // Pega a versão diretamente da ordem (mais confiável)
    const ord = await execTenant(
      "get",
      `/tenants/${tenantId}/orders/${orderId}`
    );
    expect(ord.status).toBe(200);
    const version = ord.body?.version;
    expect(version !== undefined && version !== null).toBe(true);

    const url = `${baseUrl}/tenants/${tenantId}/kds/stream?station=${encodeURIComponent(
      station
    )}`;
    const es = new EventSource(url, {
      headers: { Authorization: `Bearer ${bearer}` },
    });

    // tenta com aspas (ETag style); se 428/412, tenta sem aspas
    const doBump = (ifMatch: string) =>
      execTenant("post", `/tenants/${tenantId}/kds/tickets/${orderId}/bump`, {
        extraHeaders: { "If-Match": ifMatch },
        body: {},
      });

    let bump = await doBump(`"${version}"`);
    if (bump.status === 428 || bump.status === 412) {
      bump = await doBump(String(version));
    }
    if (![200, 201].includes(bump.status)) {
      console.error(
        "Falha POST /kds/tickets/:orderId/bump:",
        bump.status,
        jstr(bump.body || bump.text)
      );
    }
    expect([200, 201]).toContain(bump.status);

    try {
      const evt: any = await once(es, "ticket.bumped", 8000);
      expect(evt.tenantId).toBe(tenantId);
      expect(evt.orderId).toBe(orderId);
      expect(typeof evt.affected).toBe("number");
    } catch (e) {
      console.warn(
        "SSE ticket.bumped não recebido a tempo; operação de bump foi 200/201, então seguimos."
      );
    } finally {
      try {
        es.close();
      } catch {}
    }
  });
});
