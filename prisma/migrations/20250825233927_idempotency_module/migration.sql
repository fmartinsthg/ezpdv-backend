-- CreateEnum
CREATE TYPE "public"."IdempotencyStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."IdempotencyKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "public"."IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "requestHash" TEXT NOT NULL,
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "responseTruncated" BOOLEAN NOT NULL DEFAULT false,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_tenantId_scope_key_idx" ON "public"."IdempotencyKey"("tenantId", "scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_tenantId_scope_key_key" ON "public"."IdempotencyKey"("tenantId", "scope", "key");
