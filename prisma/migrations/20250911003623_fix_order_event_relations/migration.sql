-- DropForeignKey
ALTER TABLE "public"."OrderEvent" DROP CONSTRAINT "OrderEvent_orderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OrderItemEvent" DROP CONSTRAINT "OrderItemEvent_orderItemId_fkey";

-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."products" ADD COLUMN     "prepStation" "public"."PrepStation";

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_status_closedAt_idx" ON "public"."OrderItem"("tenantId", "status", "closedAt");

-- CreateIndex
CREATE INDEX "products_tenantId_prepStation_idx" ON "public"."products"("tenantId", "prepStation");

-- AddForeignKey
ALTER TABLE "public"."OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItemEvent" ADD CONSTRAINT "OrderItemEvent_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
