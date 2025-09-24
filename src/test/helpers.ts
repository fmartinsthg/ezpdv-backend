// src/test/helpers.ts
import "dotenv/config";
import request from "supertest";
import { randomUUID } from "node:crypto";

export const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3333";
export const tenantId = process.env.TEST_TENANT_ID!;
export const bearer = process.env.TEST_BEARER!;
export const defaultStation = (process.env.TEST_STATION || "BAR").toUpperCase();

if (!tenantId) throw new Error("TEST_TENANT_ID não definido");
if (!bearer) throw new Error("TEST_BEARER não definido");

export const api = request(baseUrl);
export const authH = { Authorization: `Bearer ${bearer}` };

export const idem = (scope: string) => ({
  "Idempotency-Scope": scope,
  "Idempotency-Key": randomUUID(),
});

export const PAYMENT_SCOPE =
  process.env.TEST_PAYMENT_SCOPE || "orders:payments:capture";

// “palpite” inicial: tentar COM escopo (true) ou SEM escopo (false).
export const REQUIRE_SCOPE_DEFAULT =
  (process.env.TEST_REQUIRE_SCOPE ?? "true").toLowerCase() !== "false";

export const IFMATCH_QUOTES =
  (process.env.TEST_IFMATCH_QUOTES ?? "false").toLowerCase() === "true";

const DEBUG = (process.env.TEST_DEBUG ?? "").toLowerCase() === "true";

// --- util: retry em erros de rede transitórios -----------------------------
function isTransientNetError(err: any) {
  const code = err?.code || err?.errno;
  return (
    code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT"
  );
}

async function withNetRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isTransientNetError(err)) throw err;
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 150)); // pequeno backoff
    }
  }
  throw lastErr;
}
// ---------------------------------------------------------------------------

export async function until<T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  {
    timeoutMs = 8000,
    intervalMs = 200,
  }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  const t0 = Date.now();
  let last!: T;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    last = await fn();
    if (ok(last)) return last;
    if (Date.now() - t0 > timeoutMs) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function createCategory() {
  const body = {
    name: `E2E Cat ${Date.now()}`,
    description: "Categoria para E2E pagamentos",
  };

  const res = await api
    .post("/categories")
    .set(authH)
    .set("X-Tenant-Id", tenantId)
    .set("Accept", "application/json")
    .send(body);

  if (![200, 201].includes(res.status)) {
    console.error(
      "Falha POST /categories:",
      res.status,
      JSON.stringify(res.body, null, 2)
    );
    console.error(
      "Payload enviado /categories:",
      JSON.stringify(body, null, 2)
    );
  }
  if (!res.body?.id)
    throw new Error(`Categoria não criada: HTTP ${res.status}`);
  return String(res.body.id);
}

export async function createProduct(
  categoryId: string,
  station = defaultStation
) {
  const body = {
    name: `E2E Prod ${Date.now()}`,
    description: "Produto para E2E pagamentos",
    price: "12.90",
    cost: "6.00",
    stock: "100.000", // string decimal
    categoryId,
    prepStation: station,
  };

  const res = await api
    .post("/products")
    .set(authH)
    .set("X-Tenant-Id", tenantId)
    .set("Accept", "application/json")
    .send(body);

  if (![200, 201].includes(res.status)) {
    console.error(
      "Falha POST /products:",
      res.status,
      JSON.stringify(res.body, null, 2)
    );
    console.error("Payload enviado /products:", JSON.stringify(body, null, 2));
  }
  if (!res.body?.id) throw new Error(`Produto não criado: HTTP ${res.status}`);
  return String(res.body.id);
}

export async function createOrder(productId: string, qty = 2) {
  const res = await api
    .post(`/tenants/${tenantId}/orders`)
    .set(authH)
    .set(idem("orders:create"))
    .set("Accept", "application/json")
    .send({
      tabNumber: `E2E-PAY-${Date.now()}`,
      items: [{ productId, quantity: qty }],
    });

  if (res.status !== 201) {
    console.error("Falha POST /orders:", res.status, res.body);
    throw new Error(`Order não criada: HTTP ${res.status}`);
  }

  const id = String(res.body?.id ?? "");
  const version = String(res.body?.version ?? "");
  if (!id) throw new Error("Order sem id");

  const get = await api
    .get(`/tenants/${tenantId}/orders/${id}`)
    .set(authH)
    .set("Accept", "application/json");
  if (get.status !== 200)
    throw new Error(`GET order falhou: HTTP ${get.status}`);

  const total = String(get.body?.total ?? "0.00");
  return { id, version, total };
}

export async function fireOrder(orderId: string) {
  const res = await api
    .post(`/tenants/${tenantId}/orders/${orderId}/fire`)
    .set(authH)
    .set(idem("orders:fire"))
    .set("Accept", "application/json")
    .send({});
  if (![200, 201].includes(res.status)) {
    console.error("Falha POST /orders/:id/fire:", res.status, res.body);
    throw new Error(`Fire falhou: HTTP ${res.status}`);
  }
}

export async function listKdsFired(station = defaultStation) {
  return api
    .get(`/tenants/${tenantId}/kds/items`)
    .query({ station, status: "FIRED", page: 1, pageSize: 50 })
    .set(authH)
    .set("Accept", "application/json");
}

export async function getOrder(orderId: string) {
  const res = await api
    .get(`/tenants/${tenantId}/orders/${orderId}`)
    .set(authH)
    .set("Accept", "application/json");
  if (res.status !== 200) {
    console.error("Falha GET /orders/:id:", res.status, res.body);
    throw new Error(`GET order falhou: HTTP ${res.status}`);
  }
  return res.body; // { id, version, total, isSettled?, ... }
}

export async function closeOrder(orderId: string, version?: string | number) {
  const getCurVersion = async () => (await getOrder(orderId)).version;

  const doClose = async (v: string | number, quoted: boolean) => {
    const etag = quoted ? `"${v}"` : String(v);
    if (DEBUG) console.log(`→ CLOSE If-Match: ${etag}`);
    return api
      .post(`/tenants/${tenantId}/orders/${orderId}/close`)
      .set(authH)
      .set(idem("orders:close"))
      .set("Accept", "application/json")
      .set("Connection", "close")
      .set("If-Match", etag)
      .send({});
  };

  let v: string | number = version ?? (await getCurVersion());
  let quoted = IFMATCH_QUOTES;

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

// pagamento com fallback **controlado** e key nova ao alternar escopo
export async function capturePayment(
  orderId: string,
  amount: string,
  idemKey?: string
) {
  type Policy = "auto" | "required" | "forbidden";
  const policy = (
    process.env.TEST_PAYMENT_SCOPE_POLICY ?? "auto"
  ).toLowerCase() as Policy;

  const firstWithScope =
    policy === "required"
      ? true
      : policy === "forbidden"
      ? false
      : REQUIRE_SCOPE_DEFAULT;

  const tryOnce = async (
    withScope: boolean,
    key: string
  ): Promise<request.Response> => {
    let req = api
      .post(`/tenants/${tenantId}/orders/${orderId}/payments`)
      .set(authH)
      .set("Idempotency-Key", key)
      .set("Accept", "application/json")
      .set("Connection", "close")
      .send({ orderId, method: "CASH", amount, provider: "NULL" });

    if (withScope) req = req.set("Idempotency-Scope", PAYMENT_SCOPE);

    if (DEBUG)
      console.log(
        `→ PAY (scope=${withScope ? "ON" : "OFF"}, key=${key.slice(0, 8)})`
      );

    const res = await withNetRetry(() => req);

    if (DEBUG)
      console.log(
        "← PAY status:",
        res.status,
        "body:",
        JSON.stringify(res.body, null, 2)
      );

    return res;
  };

  // 1ª tentativa
  const key1 = idemKey ?? randomUUID();
  let res = await tryOnce(firstWithScope, key1);

  // Se não for 400 ou se a política for fixa (required/forbidden), encerramos aqui
  if (res.status !== 400 || policy !== "auto") {
    if (![200, 201].includes(res.status)) {
      console.error("Falha POST /payments:", res.status, res.body);
      throw new Error(`Pagamento falhou: HTTP ${res.status}`);
    }
    return;
  }

  // Análise da mensagem para decidir fallback
  const msg =
    typeof res.body?.message === "string"
      ? res.body.message
      : JSON.stringify(res.body?.message ?? "");

  const saysForbidden = /Escopo de idempot[êe]ncia n[ãa]o permitido/i.test(msg);
  const saysRequired = /Idempotency-Scope .* obrigat[óo]rio/i.test(msg);

  let doFallback = false;
  let nextWithScope = firstWithScope;

  if (saysForbidden && firstWithScope) {
    if (DEBUG)
      console.log(
        "↻ PAY fallback: removendo scope (policy detectada: FORBIDDEN)"
      );
    nextWithScope = false;
    doFallback = true;
  } else if (saysRequired && !firstWithScope) {
    if (DEBUG)
      console.log(
        "↻ PAY fallback: adicionando scope (policy detectada: REQUIRED)"
      );
    nextWithScope = true;
    doFallback = true;
  }

  if (!doFallback) {
    // 400 por outro motivo → não ficar em loop
    console.error(
      "Falha POST /payments (sem fallback aplicável):",
      res.status,
      res.body
    );
    throw new Error(`Pagamento falhou: HTTP ${res.status}`);
  }

  // 2ª tentativa com **novo** Idempotency-Key
  const key2 = randomUUID();
  res = await tryOnce(nextWithScope, key2);

  if (![200, 201].includes(res.status)) {
    console.error("Falha POST /payments (fallback):", res.status, res.body);
    throw new Error(`Pagamento falhou: HTTP ${res.status}`);
  }
}
