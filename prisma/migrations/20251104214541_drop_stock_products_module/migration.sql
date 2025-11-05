/*
  Warnings:

  - You are about to drop the column `barcode` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `products` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."StockMovement_tenantId_relatedOrderId_idx";

-- DropIndex
DROP INDEX "public"."products_tenantId_barcode_idx";

-- DropIndex
DROP INDEX "public"."products_tenantId_barcode_key";

-- AlterTable
ALTER TABLE "public"."products" DROP COLUMN "barcode",
DROP COLUMN "stock";

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_relatedOrderId_createdAt_idx" ON "public"."StockMovement"("tenantId", "relatedOrderId", "createdAt");
