/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,openStationKey]` on the table `CashSession` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."CashSession" ADD COLUMN     "openStationKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_tenantId_openStationKey_key" ON "public"."CashSession"("tenantId", "openStationKey");
