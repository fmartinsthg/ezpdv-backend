// src/test/helpers.ts
import "dotenv/config";
import request from "supertest";
import { randomUUID } from "node:crypto";

export const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3333";
export const tenantId = process.env.TEST_TENANT_ID!;
export const bearer = process.env.TEST_BEARER!;
export const defaultStation = (process.env.TEST_STATION || "BAR").toUpperCase();

// === Multiusuário opcional ==================================================
export const bearer2 = process.env.TEST_BEARER_2 || "";
export const authH2 = bearer2 ? { Authorization: `Bearer ${bearer2}` } : null;
export const auth = (use2?: boolean) => (use2 && authH2 ? authH2 : authH);
// ===========================================================================

if (!tenantId) throw new Error("TEST_TENANT_ID não definido");
if (!bearer) throw new Error("TEST_BEARER não definido");

export const api = request(baseUrl);
export const authH = { Authorization: `Bearer ${bearer}` };

// Escopos padrão (podem ser sobrescritos por ENV)
export const PAYMENT_SCOPE =
  process.env.TEST_PAYMENT_SCOPE || "orders:payments:capture";
export const CLOSE_SCOPE = process.env.TEST_CLOSE_SCOPE || "orders:close";
export const FIRE_SCOPE = process.env.TEST_FIRE_SCOPE || "orders:fire";
export const CASH_OPEN_SCOPE = process.env.TEST_CASH_OPEN_SCOPE || "cash:open";

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
export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
      await sleep(150); // pequeno backoff
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
    await sleep(intervalMs);
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
    stock: "100.000",
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
      .set("Idempotency-Key", randomUUID())
      .set("Idempotency-Scope", "orders:create")
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
  const key = randomUUID();
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/orders/${orderId}/fire`)
      .set(authH)
      .set("Idempotency-Key", key)
      .set("Idempotency-Scope", FIRE_SCOPE)
      .set("Accept", "application/json")
      .send({})
  );
  if (![200, 201].includes(res.status)) {
    console.error("Falha POST /orders/:id/fire:", res.status, res.body);
    throw new Error(`Fire falhou: HTTP ${res.status}`);
  }
}

export async function fireOrderRaw(orderId: string) {
  const key = randomUUID(); // mesma key nas tentativas
  return httpExec("POST", `/tenants/${tenantId}/orders/${orderId}/fire`, () =>
    api
      .post(`/tenants/${tenantId}/orders/${orderId}/fire`)
      .set(authH)
      .set("Idempotency-Key", key)
      .set("Idempotency-Scope", FIRE_SCOPE)
      .set("Accept", "application/json")
      .send({})
  );
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
  return res.body;
}

// ---------------- CLOSE (friendly e raw) -----------------------------------

export async function closeOrder(orderId: string, version?: string | number) {
  const getCurVersion = async () => (await getOrder(orderId)).version;

  const doClose = async (v: string | number, quoted: boolean) => {
    const etag = quoted ? `"${v}"` : String(v);
    if (DEBUG) console.log(`→ CLOSE If-Match: ${etag}`);
    const key = randomUUID();
    return api
      .post(`/tenants/${tenantId}/orders/${orderId}/close`)
      .set(authH)
      .set("Idempotency-Key", key)
      .set("Idempotency-Scope", CLOSE_SCOPE)
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

/**
 * Heurística para identificar respostas de “já fechado / estado inválido”
 * (útil para corrida onde 400/409 podem ser aceitáveis).
 */
export function looksLikeAlreadyClosed(res: { status?: number; body?: any }) {
  const s = res?.status ?? 0;
  if (s !== 400 && s !== 409) return false;

  const msg =
    typeof res?.body?.message === "string"
      ? res.body.message
      : JSON.stringify(res?.body?.message ?? res?.body ?? "");

  const re =
    /(já\s*est[aá]\s*fechad)|(\bclosed\b)|estado\s*inv[aá]lido|invalid\s*state|order.*(closed|settled)/i;

  return re.test(msg);
}

export async function closeOrderRaw(
  orderId: string,
  version?: string | number,
  quotedPref = IFMATCH_QUOTES
) {
  const path = `/tenants/${tenantId}/orders/${orderId}/close`;
  const getCurVersion = async () => (await getOrder(orderId)).version;
  const idemKey = randomUUID(); // mesma key em todas as tentativas

  const attempt = (v: string | number, quoted: boolean) => {
    const etag = quoted ? `"${v}"` : String(v);
    return httpExec("POST", path, () =>
      api
        .post(path)
        .set(authH)
        .set("Idempotency-Key", idemKey)
        .set("Idempotency-Scope", CLOSE_SCOPE)
        .set("Accept", "application/json")
        .set("Connection", "close")
        .set("If-Match", etag)
        .send({})
    );
  };

  // 1) usa versão fornecida ou busca
  let v: string | number = version ?? (await getCurVersion());
  // 2) 1ª tentativa com preferência configurada
  let res = await attempt(v, quotedPref);

  // 429 → aguarda e reenvia com MESMA key
  if (res.status === 429) {
    const ra = Number(res.headers?.["retry-after"] ?? 0) * 1000 || 120;
    await sleep(ra);
    res = await attempt(v, quotedPref);
  }

  // 3) Se 400 (validação If-Match) tenta alternativa (tira/coloca aspas)
  if (res.status === 400) {
    res = await attempt(v, !quotedPref);
  }

  // 4) Se 412 (stale) ou 400 (persistente), pega versão fresca e tenta de novo
  if (res.status === 412 || res.status === 400) {
    v = await getCurVersion();
    res = await attempt(v, false);
    if (res.status === 400) {
      res = await attempt(v, true);
    }
    if (res.status === 429) {
      const ra = Number(res.headers?.["retry-after"] ?? 0) * 1000 || 120;
      await sleep(ra);
      res = await attempt(v, true);
    }
  }

  return res;
}

/**
 * Versão “estável”: se a versão NÃO for informada, busca a versão atual.
 * Não faz fallback de aspas/versão — apenas envia exatamente o If-Match
 * calculado e retorna a resposta “bruta” do servidor.
 */
export async function closeOrderRawStable(
  orderId: string,
  version?: string | number,
  quotedPref = IFMATCH_QUOTES
) {
  const path = `/tenants/${tenantId}/orders/${orderId}/close`;
  const idemKey = randomUUID();

  let v: string | number = version ?? (await getOrder(orderId)).version;
  const etag = quotedPref ? `"${v}"` : String(v);

  return httpExec("POST", path, () =>
    api
      .post(path)
      .set(authH)
      .set("Idempotency-Key", idemKey)
      .set("Idempotency-Scope", CLOSE_SCOPE)
      .set("Accept", "application/json")
      .set("Connection", "close")
      .set("If-Match", etag)
      .send({})
  );
}

// ---------------- Payments (com station opcional) --------------------------

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

  const key1 = idemKey ?? randomUUID();
  let res = await tryOnce(firstWithScope, key1);

  if (res.status !== 400 || policy !== "auto") {
    if (![200, 201].includes(res.status)) {
      console.error("Falha POST /payments:", res.status, res.body);
      throw new Error(`Pagamento falhou: HTTP ${res.status}`);
    }
    return;
  }

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

  const key2 = randomUUID();
  res = await tryOnce(nextWithScope, key2);

  if (![200, 201].includes(res.status)) {
    console.error("Falha POST /payments (fallback):", res.status, res.body);
    throw new Error(`Pagamento falhou: HTTP ${res.status}`);
  }
}

export async function capturePaymentRaw(
  orderId: string,
  amount: string,
  opts?: { stationId?: string; idemKey?: string; useBearer2?: boolean }
) {
  const key = opts?.idemKey ?? randomUUID();
  const h =
    opts?.useBearer2 && process.env.TEST_BEARER_2
      ? { Authorization: `Bearer ${process.env.TEST_BEARER_2}` }
      : authH;

  const build = () => {
    let req = api
      .post(`/tenants/${tenantId}/orders/${orderId}/payments`)
      .set(h)
      .set("Idempotency-Key", key) // mesma key em retries
      .set("Idempotency-Scope", PAYMENT_SCOPE)
      .set("Accept", "application/json")
      .send({ orderId, method: "CASH", amount, provider: "NULL" });
    if (opts?.stationId) req = req.set("X-Station-Id", opts.stationId);
    return req;
  };

  let res = await httpExec(
    "POST",
    `/tenants/${tenantId}/orders/${orderId}/payments`,
    build
  );

  // retries controlados para 429 (rate limit), mantendo a MESMA key
  let tries = 0;
  while (res.status === 429 && tries < 2) {
    const ra =
      Number(res.headers?.["retry-after"] ?? 0) * 1000 ||
      120 + Math.floor(Math.random() * 60);
    await sleep(ra);
    res = await httpExec(
      "POST",
      `/tenants/${tenantId}/orders/${orderId}/payments`,
      build
    );
    tries++;
  }

  return res;
}

/** Wrapper/alias mantido para compatibilidade com o stress-e2e.ts */
export async function capturePaymentRawRetry429(
  orderId: string,
  amount: string,
  opts?: { stationId?: string; idemKey?: string; useBearer2?: boolean }
) {
  return capturePaymentRaw(orderId, amount, opts);
}

export async function listPaymentsByOrder(orderId: string) {
  const res = await httpExec(
    "GET",
    `/tenants/${tenantId}/orders/${orderId}/payments`,
    () =>
      api
        .get(`/tenants/${tenantId}/orders/${orderId}/payments`)
        .set(authH)
        .set("Accept", "application/json")
  );
  return res.body;
}

// ---------------- Cash ------------------------------------------------------

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

export async function openCashSessionRaw(stationId: string) {
  const key = randomUUID();
  return httpExec("POST", `/tenants/${tenantId}/cash/sessions/open`, () =>
    api
      .post(`/tenants/${tenantId}/cash/sessions/open`)
      .set(authH)
      .set("Idempotency-Key", key)
      .set("Idempotency-Scope", CASH_OPEN_SCOPE)
      .set("Accept", "application/json")
      .send({ stationId, openingFloat: { CASH: "100.00" } })
  );
}

export async function openCashSession(stationId: string) {
  const key = randomUUID();
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/cash/sessions/open`)
      .set(authH)
      .set("Idempotency-Key", key)
      .set("Idempotency-Scope", CASH_OPEN_SCOPE)
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
      .set("Idempotency-Key", randomUUID())
      .set("Idempotency-Scope", "cash:movement")
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
      .set("Idempotency-Key", randomUUID())
      .set("Idempotency-Scope", "cash:count")
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
  const key = randomUUID();
  const res = await withNetRetry(() =>
    api
      .post(`/tenants/${tenantId}/cash/sessions/${sessionId}/close`)
      .set(authH)
      .set("Idempotency-Key", key)
      .set("Idempotency-Scope", "cash:close")
      .set("Accept", "application/json")
      .send({ note: "e2e close" })
  );

  if ([200, 201].includes(res.status)) {
    return res.body;
  }

  if (res.status === 409) {
    if (DEBUG)
      console.warn(
        "closeCashSession: sessão já estava fechada (HTTP 409), continuando…"
      );
    return { alreadyClosed: true };
  }

  console.error("Falha POST cash close:", res.status, res.body);
  throw new Error(`Close cash falhou: HTTP ${res.status}`);
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
  return res.body;
}

// --- NOVO: debug/metrics ----------------------------------------------------
const DEBUG_HTTP =
  (process.env.TEST_DEBUG_HTTP ?? "false").toLowerCase() === "true";
const METRICS_ON =
  (process.env.TEST_METRICS ?? "true").toLowerCase() !== "false";
const METRICS_JSON = process.env.TEST_METRICS_JSON || ""; // ex.: "metrics.json"

type HttpMetric = {
  method: string;
  path: string;
  status: number;
  ms: number;
};
export const httpMetrics: HttpMetric[] = [];

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}
function normPathLabel(url: string) {
  const i = url.indexOf("?");
  return i >= 0 ? url.slice(0, i) : url;
}

/** Executa o request, mede duração e coleta status. */
export async function httpExec<T extends request.Response>(
  method: string,
  path: string,
  build: () => request.Test // builder deve ser SÍNCRONO
): Promise<T> {
  const t0 = nowMs();
  // supertest.Test é thenable: dá para await diretamente
  const res = await build();
  const dt = nowMs() - t0;

  if (DEBUG_HTTP)
    console.log(`[HTTP] ${method} ${path} → ${res.status} (${dt}ms)`);

  if (METRICS_ON) {
    httpMetrics.push({
      method,
      path: normPathLabel(path),
      status: res.status,
      ms: dt,
    });
  }
  return res as T;
}

function quantile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const a = [...values].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return a[base + 1] !== undefined
    ? a[base] + rest * (a[base + 1] - a[base])
    : a[base];
}

export function printHttpMetricsSummary() {
  if (!METRICS_ON || httpMetrics.length === 0) return;

  const byRoute = new Map<string, HttpMetric[]>();
  for (const m of httpMetrics) {
    const key = `${m.method} ${m.path}`;
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key)!.push(m);
  }

  console.log("\n=== HTTP Metrics (grouped) ===");
  for (const [key, arr] of byRoute.entries()) {
    const n = arr.length;
    const statuses = new Map<number, number>();
    for (const r of arr)
      statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
    const times = arr.map((r) => r.ms);
    const avg = times.reduce((a, b) => a + b, 0) / n;
    const p95 = quantile(times, 0.95);
    const p99 = quantile(times, 0.99);

    const statusStr = [...statuses.entries()]
      .map(([s, c]) => `${s}x${c}`)
      .join(", ");
    console.log(
      `${key.padEnd(48)} | n=${n.toString().padStart(3)} | avg=${avg.toFixed(
        1
      )}ms | p95=${p95.toFixed(1)}ms | p99=${p99.toFixed(1)}ms | ${statusStr}`
    );
  }

  if (METRICS_JSON) {
    try {
      const fs = require("node:fs");
      fs.writeFileSync(
        METRICS_JSON,
        JSON.stringify({ httpMetrics }, null, 2),
        "utf8"
      );
      console.log(`\nHTTP metrics salvas em ${METRICS_JSON}`);
    } catch (e) {
      console.warn("Falha ao salvar METRICS_JSON:", e);
    }
  }
}
// ---------------------------------------------------------------------------
