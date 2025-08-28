-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "isSettled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_tenantId_isSettled_createdAt_idx" ON "public"."Order"("tenantId", "isSettled", "createdAt");
