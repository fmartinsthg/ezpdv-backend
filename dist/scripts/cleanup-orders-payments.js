"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ⚠️ Ajuste seu tenant aqui
const TENANT_ID = "b4bb2859-b33e-475f-a1e3-2032baf68e5b";
// Opcional: filtrar por data (createdAt <= ...)
const DELETE_UNTIL_ISO = null;
async function main() {
    console.log("=== Cleanup Orders & Payments ===");
    console.log(`Tenant: ${TENANT_ID}`);
    if (DELETE_UNTIL_ISO)
        console.log(`Filtrando até (createdAt <=): ${DELETE_UNTIL_ISO}`);
    // 1) Orders alvo
    const orderWhere = { tenantId: TENANT_ID };
    if (DELETE_UNTIL_ISO)
        orderWhere.createdAt = { lte: new Date(DELETE_UNTIL_ISO) };
    const orders = await prisma.order.findMany({
        where: orderWhere,
        select: { id: true, status: true, isSettled: true, createdAt: true },
    });
    const orderIds = orders.map((o) => o.id);
    console.log(`Orders candidatos: ${orders.length}`);
    if (orders.length === 0) {
        console.log("Nada para apagar. Encerrando.");
        return;
    }
    // 2) OrderItems
    const orderItems = await prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true },
    });
    const orderItemIds = orderItems.map((oi) => oi.id);
    console.log(`OrderItems dependentes: ${orderItems.length}`);
    // 3) Payments desses orders
    const payments = await prisma.payment.findMany({
        where: {
            tenantId: TENANT_ID,
            orderId: { in: orderIds },
            ...(DELETE_UNTIL_ISO
                ? { createdAt: { lte: new Date(DELETE_UNTIL_ISO) } }
                : {}),
        },
        select: { id: true },
    });
    const paymentIds = payments.map((p) => p.id);
    console.log(`Payments dependentes: ${payments.length}`);
    // Relatório
    const openCount = orders.filter((o) => o.status === "OPEN").length;
    const closedCount = orders.filter((o) => o.status === "CLOSED").length;
    const settledCount = orders.filter((o) => o.isSettled).length;
    console.log(`Resumo status → OPEN: ${openCount} | CLOSED: ${closedCount} | isSettled=true: ${settledCount}`);
    // 4) Execução em ordem segura
    // 4.0) Se existir algo filho de OrderItem, apague aqui (ex.: orderItemModifier):
    // await prisma.orderItemModifier.deleteMany({ where: { orderItemId: { in: orderItemIds } } });
    // 4.1) Apagar transações dos payments (resolve FK PaymentTransaction_paymentId_fkey)
    if (paymentIds.length > 0) {
        const delPayTx = await prisma.paymentTransaction.deleteMany({
            where: { paymentId: { in: paymentIds } },
        });
        console.log(`PaymentTransactions removidos: ${delPayTx.count}`);
    }
    else {
        console.log("Nenhum PaymentTransaction para remover (sem payments).");
    }
    // 4.2) Agora apagar os payments
    if (paymentIds.length > 0) {
        const delPay = await prisma.payment.deleteMany({
            where: { id: { in: paymentIds } },
        });
        console.log(`Payments removidos: ${delPay.count}`);
    }
    else {
        console.log("Nenhum Payment para remover.");
    }
    // 4.3) Apagar orderItems
    if (orderItemIds.length > 0) {
        const delItems = await prisma.orderItem.deleteMany({
            where: { id: { in: orderItemIds } },
        });
        console.log(`OrderItems removidos: ${delItems.count}`);
    }
    else {
        console.log("Nenhum OrderItem para remover.");
    }
    // 4.4) Se tiver KDS/tickets/eventos por orderId, apague aqui:
    // await prisma.kitchenTicket.deleteMany({ where: { orderId: { in: orderIds } } });
    // await prisma.kitchenEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    // 4.5) Por fim, apagar orders
    const delOrders = await prisma.order.deleteMany({
        where: { id: { in: orderIds } },
    });
    console.log(`Orders removidos: ${delOrders.count}`);
    console.log("Cleanup concluído ✅");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
