import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ⚠️ CONFIRA o tenantId
const TENANT_ID = "b4bb2859-b33e-475f-a1e3-2032baf68e5b";

// ⚠️ SUA LISTA DE IDs QUE QUER LIMPAR
const IDS: string[] = [
  "02a53b2d-973b-4703-8941-a7b833dfdb19",
  "cb5fcea7-89b8-47f7-9714-b758e4637bb5",
  "be215739-824a-4b03-8bf7-fc6107f2aa55",
  "0f9273f7-db31-4373-bdf4-1f81a9ce726a",
  "18e9c8d2-2107-4b72-91f3-34c74f871f36",
  "2a3a37de-4f91-45fb-8b02-dc81eba2b472",
  "e4f0532c-cec7-4e2b-9fef-8f46133b5d40",
  "c0981e09-a6d6-434f-be94-9601f5f4381e",
  "bf9ee528-ce61-48e1-8e97-1ea1ace6332e",
  "48b21936-38c2-41f6-8546-ccb8dc6b4e49",
  "faed0195-ece3-4839-9d0e-10400ba57d35",
  "c93edb42-2a58-4da5-8470-269200254000",
  "f75e0fde-b786-4baa-9903-e32dff2a617b",
  "e6b08eb5-5599-4b41-ba66-f34d7c4c502e",
  "5d66e31e-f6ba-4f51-bbd6-2b7f08a1018b",
  "9e08e14c-9a57-402d-8e45-7abc1dd26738",
  "43989640-b26e-4c9c-982f-eb0b114ceebc",
  "8ec6b838-66f8-4c70-aeda-1a35e372a38a",
  "6266e5c9-ea19-408d-9fc4-f583f6bb4e26",
  "15e3235c-cc23-41c7-bc63-375ebc8d2c3b",
  "85ca9a55-c661-4fe0-bf30-dd37227f084f",
  "693ff685-9d5a-4efd-9c44-0fb19409541e",
  "23c554e0-c84a-4945-9457-2802120d320b",
  "8e44e3e2-32f5-46fd-9175-fcb8f6636ae2",
  "1a552573-dc8d-4537-8fc5-597aa9e4a12f",
  "f4b91609-48ed-4d84-aaee-a5900ddf3517",
  "0c420f70-b4b7-48a2-ba52-8af40d4d795d",
  "2972a033-20e7-49d1-83d1-b4731da5bdd1",
  "6fe285a9-ebee-4a60-adf9-76e36d9d5fa0",
  "252ecac0-eb37-4f74-a317-d41db0d600e4",
  "a55930f5-d9a6-4892-9fcb-d28d878b4246",
  "bd7ba77d-fb90-4925-81a1-4ef08ba08a6b",
  "2a6d6253-09a8-4af3-8f47-635c47f8bfcc",
  "20df41ba-f9df-47d4-a1c8-2a8179bd7513",
  "662cfabe-ce25-4ffd-9ed2-15cdfba3b2a2",
  "fdca61a1-0943-4227-91e6-ad0f41de9dc6",
  "9c0ada38-b133-4c5f-b61c-55275821734a",
  "ebfb15dd-350c-4276-918a-03ad269a6e34",
  "36313a3e-90b4-4ba3-aa8e-d9c937d81df3",
  "3b09ef5b-5d2e-4035-8272-b067d71cf806",
  "c2a77341-10b7-4334-a092-2630b8ce2b31",
  "b3e7c2c6-e25f-4241-a477-47037dae1292",
  "2e657e50-9856-434d-a869-35b9b60d4ab0",
  "83503b2e-2db6-4152-a42d-db3dd400e0b8",
  "2619a416-4e48-4c29-a4dc-0e4d65cd17c3",
  "d01a8a8a-78e4-45cd-b766-3b344ad2adc6",
  "1c5106de-d398-45e9-a753-e9f9041a7f18",
  "e3c1742b-e160-42b1-b7ae-e9f0d9193cfb",
  "87859d06-8a65-421a-a6f3-a7180614d6f0",
  "fc064d1a-8ce1-4978-8635-a8e2d50dcb09",
  "5c81ac69-d954-445d-bc91-a4b1e30794b3",
  "80ff0185-34e8-494d-b5ab-01a3cbe75afe",
  "89885722-944f-4efa-9fc9-1e322f406167",
  "fe9c27ee-abe5-49b0-a1fa-17a4a5bd960d",
  "ca24134b-7498-4e39-85df-2053ec1d3afd",
  "5484fcf8-4501-4758-bf7d-8548170e5475",
  "238d006b-4807-4bdf-83aa-21a56e36763e",
  "93650b18-6867-4b56-9282-766039e5b373",
  "3f838065-650f-4b83-b754-9a6c687f7ddc",
  "322be93b-d938-4e1b-889b-7099e04068fd",
  "173c8586-5b18-40af-ad75-8a5cd70cf429",
  "f28368ae-4ed0-4f0c-80f0-f08311a8f553",
  "a5749111-a1fa-4ec3-9df0-16f7e8fff601",
];

async function main() {
  // 1) Quais desses IDs têm Recipe?
  const recipes = await prisma.recipe.findMany({
    where: { tenantId: TENANT_ID, productId: { in: IDS } },
    select: { productId: true },
    distinct: ["productId"],
  });
  const hasRecipe = new Set(recipes.map((r) => r.productId));

  const protectedIds = IDS.filter((id) => hasRecipe.has(id)); // manter
  const deletableIds = IDS.filter((id) => !hasRecipe.has(id)); // apagar

  console.log(`Total na lista: ${IDS.length}`);
  console.log(`Com Recipe (protegidos): ${protectedIds.length}`);
  console.log(protectedIds);
  console.log(`Sem Recipe (deletáveis): ${deletableIds.length}`);
  console.log(deletableIds);

  if (deletableIds.length === 0) {
    console.log("Nada para apagar. Saindo.");
    return;
  }

  // 2) Remover OrderItems que referenciam APENAS os deletáveis
  const oiBefore = await prisma.orderItem.count({
    where: { tenantId: TENANT_ID, productId: { in: deletableIds } },
  });
  if (oiBefore > 0) {
    const oiDel = await prisma.orderItem.deleteMany({
      where: { tenantId: TENANT_ID, productId: { in: deletableIds } },
    });
    console.log(`OrderItems removidos: ${oiDel.count}`);
  } else {
    console.log("Sem OrderItems dependentes dos deletáveis.");
  }

  // 3) Apagar os Products deletáveis
  const pDel = await prisma.product.deleteMany({
    where: { tenantId: TENANT_ID, id: { in: deletableIds } },
  });
  console.log(`Produtos removidos: ${pDel.count}`);

  // 4) Verificação
  const remaining = await prisma.product.count({
    where: { tenantId: TENANT_ID, id: { in: deletableIds } },
  });
  console.log(`Restantes (deletáveis) após delete: ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
