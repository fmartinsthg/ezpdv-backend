/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,providerTxnId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdByUserId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'CAPTURED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."PaymentTransactionType" AS ENUM ('CAPTURE', 'REFUND', 'CANCEL');

-- AlterEnum
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'VOUCHER';

-- DropIndex
DROP INDEX "public"."Payment_tenantId_orderId_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "createdByUserId" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerTxnId" TEXT,
ADD COLUMN     "status" "public"."PaymentStatus" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."PaymentTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" "public"."PaymentTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "byUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentTransaction_tenantId_createdAt_idx" ON "public"."PaymentTransaction"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_tenantId_type_idx" ON "public"."PaymentTransaction"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Payment_tenantId_orderId_idx" ON "public"."Payment"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "public"."Payment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "public"."Payment"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_providerTxnId_key" ON "public"."Payment"("tenantId", "providerTxnId");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
