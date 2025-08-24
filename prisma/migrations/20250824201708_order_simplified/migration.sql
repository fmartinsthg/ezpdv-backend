/*
  Warnings:

  - The values [PAID] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `createdByUserId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."OrderItemStatus" AS ENUM ('STAGED', 'FIRED', 'CLOSED', 'VOID');

-- CreateEnum
CREATE TYPE "public"."PrepStation" AS ENUM ('KITCHEN', 'BAR', 'DESSERT', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."OrderStatus_new" AS ENUM ('OPEN', 'CLOSED', 'CANCELED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Order" ALTER COLUMN "status" TYPE "public"."OrderStatus_new" USING ("status"::text::"public"."OrderStatus_new");
ALTER TYPE "public"."OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "public"."OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "public"."Order" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_cashierUserId_fkey";

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "createdByUserId" TEXT NOT NULL,
ADD COLUMN     "tabNumber" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "cashierUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "firedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "station" "public"."PrepStation",
ADD COLUMN     "status" "public"."OrderItemStatus" NOT NULL DEFAULT 'STAGED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "voidApprovedBy" TEXT,
ADD COLUMN     "voidByUserId" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."StockMovement" ADD COLUMN     "reason" TEXT;

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_orderId_idx" ON "public"."OrderItem"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_orderId_createdAt_idx" ON "public"."Payment"("tenantId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_inventoryItemId_createdAt_idx" ON "public"."StockMovement"("tenantId", "inventoryItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_cashierUserId_fkey" FOREIGN KEY ("cashierUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_voidByUserId_fkey" FOREIGN KEY ("voidByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_voidApprovedBy_fkey" FOREIGN KEY ("voidApprovedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
