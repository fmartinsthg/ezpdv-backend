-- CreateIndex
CREATE INDEX "idx_kds_items" ON "public"."OrderItem"("tenantId", "station", "status", "voidedAt", "firedAt", "updatedAt");
