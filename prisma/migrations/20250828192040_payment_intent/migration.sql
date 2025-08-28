/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,provider,providerTxnId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentIntentStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."PaymentAttemptStatus" AS ENUM ('INIT', 'AUTHORIZED', 'CAPTURED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PixChargeStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELED');

-- AlterEnum
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'AUTHORIZED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentTransactionType" ADD VALUE 'AUTHORIZE';
ALTER TYPE "public"."PaymentTransactionType" ADD VALUE 'VOID';

-- DropIndex
DROP INDEX "public"."Payment_tenantId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Payment_tenantId_orderId_idx";

-- DropIndex
DROP INDEX "public"."Payment_tenantId_providerTxnId_key";

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "paymentIntentId" TEXT;

-- CreateTable
CREATE TABLE "public"."PaymentIntent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "amountDue" DECIMAL(10,2) NOT NULL,
    "status" "public"."PaymentIntentStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTxnId" TEXT NOT NULL,
    "status" "public"."PaymentAttemptStatus" NOT NULL DEFAULT 'INIT',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pix_charges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "qrData" TEXT NOT NULL,
    "emv" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."PixChargeStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pix_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentIntent_tenantId_orderId_status_idx" ON "public"."PaymentIntent"("tenantId", "orderId", "status");

-- CreateIndex
CREATE INDEX "payment_attempts_tenantId_paymentId_status_idx" ON "public"."payment_attempts"("tenantId", "paymentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_tenantId_provider_providerTxnId_key" ON "public"."payment_attempts"("tenantId", "provider", "providerTxnId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_eventId_key" ON "public"."webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "pix_charges_tenantId_paymentIntentId_status_idx" ON "public"."pix_charges"("tenantId", "paymentIntentId", "status");

-- CreateIndex
CREATE INDEX "Payment_tenantId_orderId_createdAt_idx" ON "public"."Payment"("tenantId", "orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_provider_providerTxnId_key" ON "public"."Payment"("tenantId", "provider", "providerTxnId");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "public"."PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentIntent" ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentIntent" ADD CONSTRAINT "PaymentIntent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentIntent" ADD CONSTRAINT "PaymentIntent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_attempts" ADD CONSTRAINT "payment_attempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pix_charges" ADD CONSTRAINT "pix_charges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pix_charges" ADD CONSTRAINT "pix_charges_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "public"."PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
