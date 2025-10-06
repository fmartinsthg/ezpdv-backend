-- DropIndex
DROP INDEX "public"."IdempotencyKey_tenantId_scope_key_idx";

-- CreateIndex
CREATE INDEX "IdempotencyKey_tenantId_scope_idx" ON "public"."IdempotencyKey"("tenantId", "scope");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "public"."IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_station_status_firedAt_updatedAt_idx" ON "public"."OrderItem"("tenantId", "station", "status", "firedAt", "updatedAt");
