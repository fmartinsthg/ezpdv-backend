// src/webhooks/presenter.ts
export function presentEndpoint(e: any) {
  const secret = e.secret ? `${'*'.repeat(Math.max(0, e.secret.length - 4))}${e.secret.slice(-4)}` : '';
  return { ...e, secret };
}
