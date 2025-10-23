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

// ---------------- Catalog (top-level + X-Tenant-Id) ------------------------

export async function createCategory() {
  const body = {
    name: `E2E Cat ${Date.now()}`,
    description: "Categoria para E2E pagamentos",
  };

  const res = await withNetRetry(() =>
    api
      .post("/categories")
      .set(authH)
      .set("X-Tenant-Id", tenantId)
      .set("Accept", "application/json")
      .send(body)
  );

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

  const res = await withNetRetry(() =>
    api
      .post("/products")
      .set(authH)
      .set("X-Tenant-Id", tenantId)
      .set("Accept", "application/json")
      .send(body)
  );

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

// ---------------- Orders (tenant path) -------------------------------------

export async function createOrder(productId: string, qty = 2) {
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/orders`)
      .set(authH)
      .set(idem("orders:create"))
      .set("Accept", "application/json")
      .send({
        tabNumber: `E2E-PAY-${Date.now()}`,
        items: [{ productId, quantity: qty }],
      })
  );

  if (res.status !== 201) {
    console.error("Falha POST /orders:", res.status, res.body);
    throw new Error(`Order não criada: HTTP ${res.status}`);
  }

  const id = String(res.body?.id ?? "");
  const version = String(res.body?.version ?? "");
  if (!id) throw new Error("Order sem id");

  const get = await withNetRetry(() =>
    api
      .get(`/tenants/${tenantId}/orders/${id}`)
      .set(authH)
      .set("Accept", "application/json")
  );
  if (get.status !== 200)
    throw new Error(`GET order falhou: HTTP ${get.status}`);

  const total = String(get.body?.total ?? "0.00");
  return { id, version, total };
}

export async function fireOrder(orderId: string) {
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/orders/${orderId}/fire`)
      .set(authH)
      .set(idem("orders:fire"))
      .set("Accept", "application/json")
      .send({})
  );
  if (![200, 201].includes(res.status)) {
    console.error("Falha POST /orders/:id/fire:", res.status, res.body);
    throw new Error(`Fire falhou: HTTP ${res.status}`);
  }
}

export async function listKdsFired(station = defaultStation) {
  return withNetRetry(() =>
    api
      .get(`/tenants/${tenantId}/kds/items`)
      .query({ station, status: "FIRED", page: 1, pageSize: 50 })
      .set(authH)
      .set("Accept", "application/json")
  );
}

export async function getOrder(orderId: string) {
  const res = await withNetRetry(() =>
    api
      .get(`/tenants/${tenantId}/orders/${orderId}`)
      .set(authH)
      .set("Accept", "application/json")
  );
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

// ---------------- Payments (com station opcional) --------------------------

/**
 * Captura pagamento em CASH por padrão.
 * Assinatura preservada: (orderId, amount, idemKey?) e
 * foi adicionado o 4º parâmetro opcional stationId para enviar X-Station-Id.
 */
export async function capturePayment(
  orderId: string,
  amount: string,
  idemKey?: string,
  stationId?: string
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
    if (stationId) req = req.set("X-Station-Id", stationId);

    if (DEBUG)
      console.log(
        `→ PAY (scope=${withScope ? "ON" : "OFF"}, key=${key.slice(
          0,
          8
        )}, station=${stationId ?? "-"})`
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

  // Se não for 400 ou se a política for fixa (required/forbidden), encerra
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
      console.log("↻ PAY fallback: removendo scope (FORBIDDEN detectado)");
    nextWithScope = false;
    doFallback = true;
  } else if (saysRequired && !firstWithScope) {
    if (DEBUG) console.log("↻ PAY fallback: adicionando scope (REQUIRED)");
    nextWithScope = true;
    doFallback = true;
  }

  if (!doFallback) {
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

// ---------------- Cash (novo) ----------------------------------------------

/** Localiza uma sessão OPEN para a estação (via listagem). */
export async function findOpenCashSessionId(
  stationId: string
): Promise<string | null> {
  const res = await withNetRetry(() =>
    api
      .get(`/tenants/${tenantId}/cash/sessions`)
      .query({ status: "OPEN", stationId, page: 1, pageSize: 1 })
      .set(authH)
      .set("Accept", "application/json")
  );
  if (res.status !== 200) return null;
  const id = res.body?.items?.[0]?.id;
  return id ? String(id) : null;
}

/**
 * Abre sessão se não existir; se já existir (409), reaproveita a OPEN.
 * Mantém o nome exportado openCashSession para não quebrar quem usa.
 */
export async function openCashSession(stationId: string) {
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/cash/sessions/open`)
      .set(authH)
      .set(idem("cash:open"))
      .set("Accept", "application/json")
      .send({
        stationId,
        openingFloat: { CASH: "150.00" },
        notes: "e2e open",
      })
  );

  if ([200, 201].includes(res.status)) {
    const id = String(res.body?.id ?? "");
    if (!id) throw new Error("Open cash retornou sem id");
    return id;
  }

  // 409 = já existe OPEN → localizar e retornar
  if (res.status === 409) {
    const openId = await findOpenCashSessionId(stationId);
    if (!openId)
      throw new Error(
        "Já existe sessão OPEN, mas não consegui localizar o id (listagem vazia)"
      );
    return openId;
  }

  console.error(
    "Falha POST /cash/sessions/open:",
    res.status,
    JSON.stringify(res.body, null, 2)
  );
  throw new Error(`Open cash falhou: HTTP ${res.status}`);
}

export async function createCashMovement(
  sessionId: string,
  type: "SUPRIMENTO" | "SANGRIA",
  amount: string,
  reason?: string
) {
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/cash/sessions/${sessionId}/movements`)
      .set(authH)
      .set(idem("cash:movement"))
      .set("Accept", "application/json")
      .send({ type, method: "CASH", amount, reason })
  );

  if (![200, 201].includes(res.status)) {
    console.error("Falha POST cash movement:", res.status, res.body);
    throw new Error(`Movement falhou: HTTP ${res.status}`);
  }
}

export async function createCashCount(
  sessionId: string,
  kind: "PARTIAL" | "FINAL",
  total: string,
  denominations: Record<string, number> = {}
) {
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/cash/sessions/${sessionId}/counts`)
      .set(authH)
      .set(idem("cash:count"))
      .set("Accept", "application/json")
      .send({ kind, total, denominations })
  );

  if (![200, 201].includes(res.status)) {
    console.error("Falha POST cash count:", res.status, res.body);
    throw new Error(`Count falhou: HTTP ${res.status}`);
  }
}

export async function getCashSessionDetail(sessionId: string) {
  const res = await withNetRetry(() =>
    api
      .get(`/tenants/${tenantId}/cash/sessions/${sessionId}`)
      .set(authH)
      .set("Accept", "application/json")
  );

  if (res.status !== 200) {
    console.error("Falha GET cash session:", res.status, res.body);
    throw new Error(`GET cash session falhou: HTTP ${res.status}`);
  }
  return res.body;
}

export async function closeCashSession(sessionId: string) {
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/cash/sessions/${sessionId}/close`)
      .set(authH)
      .set(idem("cash:close"))
      .set("Accept", "application/json")
      .send({ note: "e2e close" })
  );

  if (![200, 201].includes(res.status)) {
    console.error("Falha POST cash close:", res.status, res.body);
    throw new Error(`Close cash falhou: HTTP ${res.status}`);
  }
  return res.body; // summary
}

export async function getDailyReport(dateISO: string /* yyyy-MM-dd */) {
  const res = await withNetRetry(() =>
    api
      .get(`/tenants/${tenantId}/cash/reports/daily`)
      .query({ date: dateISO })
      .set(authH)
      .set("Accept", "application/json")
  );

  if (res.status !== 200) {
    console.error("Falha GET cash daily report:", res.status, res.body);
    throw new Error(`Daily report falhou: HTTP ${res.status}`);
  }
  return res.body; // { CASH?: "..." , ... }
}
