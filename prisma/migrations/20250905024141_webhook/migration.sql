/*
  Warnings:

  - You are about to drop the `WebhookDelivery` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WebhookEndpoint` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WebhookEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."WebhookDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- DropForeignKey
ALTER TABLE "public"."WebhookDelivery" DROP CONSTRAINT "WebhookDelivery_endpointId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WebhookDelivery" DROP CONSTRAINT "WebhookDelivery_eventId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WebhookEndpoint" DROP CONSTRAINT "WebhookEndpoint_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WebhookEvent" DROP CONSTRAINT "WebhookEvent_tenantId_fkey";

-- DropTable
DROP TABLE "public"."WebhookDelivery";

-- DropTable
DROP TABLE "public"."WebhookEndpoint";

-- DropTable
DROP TABLE "public"."WebhookEvent";

-- CreateTable
CREATE TABLE "public"."webhook_endpoints" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "status" "public"."WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "responseCode" INTEGER,
    "responseTimeMs" INTEGER,
    "nextRetryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_endpoints_tenantId_isActive_idx" ON "public"."webhook_endpoints"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "webhook_events_tenantId_createdAt_idx" ON "public"."webhook_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_events_tenantId_type_occurredAt_idx" ON "public"."webhook_events"("tenantId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_status_nextRetryAt_idx" ON "public"."webhook_deliveries"("tenantId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_createdAt_status_idx" ON "public"."webhook_deliveries"("tenantId", "createdAt", "status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_endpointId_status_idx" ON "public"."webhook_deliveries"("tenantId", "endpointId", "status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenantId_eventId_idx" ON "public"."webhook_deliveries"("tenantId", "eventId");

-- AddForeignKey
ALTER TABLE "public"."webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."webhook_events" ADD CONSTRAINT "webhook_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."webhook_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "public"."webhook_endpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
