"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ⚠️ Ajuste para o seu tenant
const TENANT_ID = "b4bb2859-b33e-475f-a1e3-2032baf68e5b";
// Opcional: DRY RUN para inspecionar (não executar mutações) => set DRY_RUN=1
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
async function main() {
    console.log("=== Cleanup de Categorias (poupa categorias com produtos protegidos/Recipe) ===");
    console.log(`Tenant: ${TENANT_ID}`);
    console.log(`DRY_RUN: ${DRY_RUN ? "ON" : "OFF"}`);
    // 1) Produtos protegidos (têm Recipe)
    const protectedProducts = await prisma.recipe.findMany({
        where: { tenantId: TENANT_ID },
        select: { productId: true },
        distinct: ["productId"],
    });
    const protectedProductIds = protectedProducts.map((r) => r.productId);
    console.log(`Produtos protegidos (por Recipe): ${protectedProductIds.length}`);
    // Se não houver protegidos, podemos simplesmente apagar todas as categorias do tenant (se for o caso).
    // Mas seguiremos a lógica para manter robustez.
    // 2) Categorias a manter = categorias que possuem pelo menos 1 produto protegido
    const categoriesForProtectedProducts = await prisma.product.findMany({
        where: {
            tenantId: TENANT_ID,
            id: { in: protectedProductIds },
            categoryId: { not: null },
        },
        select: { categoryId: true },
        distinct: ["categoryId"],
    });
    const keepCategoryIds = new Set(categoriesForProtectedProducts
        .map((p) => p.categoryId)
        .filter((id) => !!id));
    console.log(`Categorias a manter (por abrigarem produtos protegidos): ${keepCategoryIds.size}`);
    // 3) Todas as categorias do tenant (para calcular as a excluir e ajustar hierarquia)
    const allCategories = await prisma.category.findMany({
        where: { tenantId: TENANT_ID },
        select: { id: true, parentId: true },
    });
    const allCategoryIds = new Set(allCategories.map((c) => c.id));
    // 4) Categorias a deletar = todas - manter
    const deleteCategoryIds = [...allCategoryIds].filter((id) => !keepCategoryIds.has(id));
    console.log(`Categorias candidatas a deletar: ${deleteCategoryIds.length}`);
    if (deleteCategoryIds.length === 0) {
        console.log("Não há categorias para deletar. Encerrando.");
        return;
    }
    // 5) Ajuste de hierarquia:
    // Se alguma categoria mantida tem parentId que está em deleteCategoryIds, zerar parentId dessa mantida
    const keptWithParentToDelete = allCategories.filter((c) => keepCategoryIds.has(c.id) &&
        c.parentId &&
        deleteCategoryIds.includes(c.parentId));
    console.log(`Categorias mantidas com parentId a ser deletado: ${keptWithParentToDelete.length}`);
    if (!DRY_RUN && keptWithParentToDelete.length > 0) {
        const res = await prisma.category.updateMany({
            where: {
                tenantId: TENANT_ID,
                id: { in: keptWithParentToDelete.map((c) => c.id) },
            },
            data: { parentId: null },
        });
        console.log(`parentId zerado para ${res.count} categorias mantidas.`);
    }
    // 6) Desanexar produtos de categorias que serão deletadas (apenas produtos não-protegidos)
    const productsAttachedToDeletingCats = await prisma.product.findMany({
        where: {
            tenantId: TENANT_ID,
            categoryId: { in: deleteCategoryIds },
        },
        select: { id: true, categoryId: true },
    });
    const productIdsToNullCategory = productsAttachedToDeletingCats
        .map((p) => p.id)
        .filter((id) => !protectedProductIds.includes(id)); // só desanexa os não-protegidos
    console.log(`Produtos que serão desanexados das categorias a deletar (não-protegidos): ${productIdsToNullCategory.length}`);
    if (!DRY_RUN && productIdsToNullCategory.length > 0) {
        const res = await prisma.product.updateMany({
            where: { tenantId: TENANT_ID, id: { in: productIdsToNullCategory } },
            data: { categoryId: null },
        });
        console.log(`Produtos desanexados (categoryId=null): ${res.count}`);
    }
    // 7) Verificação de segurança:
    // Garante que nenhum produto existente aponta para categorias a deletar (sobretudo os protegidos).
    // Se ainda restar algum, paramos e reportamos.
    const stillPointing = await prisma.product.count({
        where: { tenantId: TENANT_ID, categoryId: { in: deleteCategoryIds } },
    });
    if (stillPointing > 0) {
        console.warn(`ABORTADO: ainda existem ${stillPointing} produtos apontando para categorias candidatas à deleção.`);
        console.warn(`Revise vínculos antes de prosseguir (há produtos fora do escopo ou protegidos vinculados a categorias candidatas).`);
        return;
    }
    // 8) Deletar categorias
    if (!DRY_RUN) {
        const delRes = await prisma.category.deleteMany({
            where: { tenantId: TENANT_ID, id: { in: deleteCategoryIds } },
        });
        console.log(`Categorias removidas: ${delRes.count}`);
    }
    else {
        console.log("[DRY_RUN] Nenhuma deleção executada.");
    }
    // 9) Relatório final
    const remain = await prisma.category.count({
        where: { tenantId: TENANT_ID },
    });
    console.log(`Categorias restantes no tenant após operação: ${remain}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
