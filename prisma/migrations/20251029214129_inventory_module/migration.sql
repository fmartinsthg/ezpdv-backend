/*
  Warnings:

  - A unique constraint covering the columns `[recipeId,inventoryItemId]` on the table `RecipeLine` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uniqueScopeKey]` on the table `StockMovement` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."InventoryItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."StockMovement" ADD COLUMN     "uniqueScopeKey" TEXT;

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_isIngredient_idx" ON "public"."InventoryItem"("tenantId", "isIngredient");

-- CreateIndex
CREATE INDEX "RecipeLine_inventoryItemId_idx" ON "public"."RecipeLine"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeLine_recipeId_inventoryItemId_key" ON "public"."RecipeLine"("recipeId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_uniqueScopeKey_key" ON "public"."StockMovement"("uniqueScopeKey");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_relatedOrderId_idx" ON "public"."StockMovement"("tenantId", "relatedOrderId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_type_createdAt_idx" ON "public"."StockMovement"("tenantId", "type", "createdAt");
