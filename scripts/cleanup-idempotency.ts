// scripts/cleanup-idempotency.ts
import { PrismaClient, IdempotencyStatus } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = process.env.TENANT_ID || ""; // ex: export TENANT_ID=...
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 7);
const STUCK_MINUTES = Number(process.env.STUCK_MINUTES || 2);

function mustTenant() {
  if (!TENANT_ID) {
    console.error("ERR: defina TENANT_ID no ambiente.");
    process.exit(1);
  }
}

async function purgeExpired() {
  mustTenant();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Apenas SUCCEEDED/FAILED/EXPIRED e com expiresAt antigo
  const where = {
    tenantId: TENANT_ID,
    expiresAt: { lt: cutoff },
    status: {
      in: [
        IdempotencyStatus.SUCCEEDED,
        IdempotencyStatus.FAILED,
        IdempotencyStatus.EXPIRED,
      ] as IdempotencyStatus[],
    },
  };

  const { count } = await prisma.idempotencyKey.deleteMany({ where });
  console.log(
    `PURGE-EXPIRED: deletados=${count} (retentionDays=${RETENTION_DAYS})`
  );
}

async function forceRetryStuck() {
  mustTenant();
  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000);

  // PROCESSING muito antigo → marcar como FAILED para permitir reprocesso
  const { count } = await prisma.idempotencyKey.updateMany({
    where: {
      tenantId: TENANT_ID,
      status: IdempotencyStatus.PROCESSING,
      createdAt: { lt: cutoff },
    },
    data: {
      status: IdempotencyStatus.FAILED,
      errorCode: "FORCED_RETRY_STUCK",
      errorMessage: `Marcado como FAILED pelo cleanup após ${STUCK_MINUTES}min em PROCESSING`,
    },
  });
  console.log(
    `FORCE-RETRY-STUCK: marcados=${count} (processing>${STUCK_MINUTES}min)`
  );
}

async function nukeScope(scope: string) {
  mustTenant();
  if (!scope) {
    console.error("ERR: informe o scope para nuke-scope");
    process.exit(1);
  }
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { tenantId: TENANT_ID, scope },
  });
  console.log(`NUKE-SCOPE '${scope}': deletados=${count}`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);

  console.log("=== Idempotency Cleanup ===");
  console.log(`Tenant: ${TENANT_ID || "(não definido)"}`);
  console.log(`Cmd: ${cmd}`);

  switch (cmd) {
    case "purge-expired":
      await purgeExpired();
      break;
    case "force-retry-stuck":
      await forceRetryStuck();
      break;
    case "nuke-scope":
      await nukeScope(arg || "");
      break;
    default:
      console.log("Uso:");
      console.log(
        "  npx tsx scripts/cleanup-idempotency.ts purge-expired    # apaga SUCCEEDED/FAILED/EXPIRED antigos"
      );
      console.log(
        "  npx tsx scripts/cleanup-idempotency.ts force-retry-stuck # marca PROCESSING antigos como FAILED"
      );
      console.log(
        "  npx tsx scripts/cleanup-idempotency.ts nuke-scope orders:create # DEV: apaga tudo do scope"
      );
  }
}

main().finally(() => prisma.$disconnect());
