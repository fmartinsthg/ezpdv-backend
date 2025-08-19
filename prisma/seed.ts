/* eslint-disable no-console */
import { PrismaClient, Prisma, SystemRole, TenantRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// helper Decimal
const D = (v: string | number) => new Prisma.Decimal(v);

// log helpers
const log = {
  info: (m: string) => console.log(`\x1b[36m[i]\x1b[0m ${m}`),
  ok: (m: string) => console.log(`\x1b[32m[ok]\x1b[0m ${m}`),
  err: (m: string) => console.error(`\x1b[31m[err]\x1b[0m ${m}`),
};

async function upsertUser(
  email: string,
  name: string,
  password: string,
  systemRole: SystemRole = SystemRole.NONE
) {
  const hash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, password: hash, active: true, systemRole },
  });
}

async function createTenant(name: string, slug?: string) {
  return prisma.tenant.create({ data: { name, slug } });
}

async function addMembership(
  userId: string,
  tenantId: string,
  role: TenantRole
) {
  return prisma.userTenant.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    update: { role },
    create: { userId, tenantId, role },
  });
}

async function createCategory(
  tenantId: string,
  name: string,
  description?: string
) {
  return prisma.category.create({
    data: { tenantId, name, description, isActive: true },
  });
}

async function createProduct(params: {
  tenantId: string;
  name: string;
  price: string | number;
  cost: string | number;
  stock: number;
  categoryId?: string | null;
  description?: string | null;
  barcode?: string | null;
  isActive?: boolean;
}) {
  const {
    tenantId,
    name,
    price,
    cost,
    stock,
    categoryId = null,
    description = null,
    barcode = null,
    isActive = true,
  } = params;

  return prisma.product.create({
    data: {
      tenantId,
      name,
      description: description ?? undefined,
      price: D(price),
      cost: D(cost),
      stock,
      barcode: barcode ?? undefined,
      isActive,
      categoryId: categoryId ?? undefined,
    },
  });
}

async function seedTenantFull(opts: {
  tenantName: string;
  slug?: string;
  ownerEmail: string;
  ownerName: string;
  managerEmail: string;
  managerName: string;
  waiterEmail: string;
  waiterName: string;
}) {
  const {
    tenantName,
    slug,
    ownerEmail,
    ownerName,
    managerEmail,
    managerName,
    waiterEmail,
    waiterName,
  } = opts;

  log.info(`Criando tenant: ${tenantName}`);
  const tenant = await createTenant(tenantName, slug);

  // cria usuários
  const owner = await upsertUser(
    ownerEmail,
    ownerName,
    "123456",
    SystemRole.NONE
  );
  const manager = await upsertUser(
    managerEmail,
    managerName,
    "123456",
    SystemRole.NONE
  );
  const waiter = await upsertUser(
    waiterEmail,
    waiterName,
    "123456",
    SystemRole.NONE
  );

  // vincula papéis no tenant
  await addMembership(owner.id, tenant.id, TenantRole.ADMIN);
  await addMembership(manager.id, tenant.id, TenantRole.MODERATOR);
  await addMembership(waiter.id, tenant.id, TenantRole.USER);

  // categorias
  const bebidas = await createCategory(
    tenant.id,
    "Bebidas",
    "Bebidas em geral"
  );
  const drinks = await createCategory(tenant.id, "Drinks", "Coquetéis");
  const comidas = await createCategory(
    tenant.id,
    "Comidas",
    "Pratos e porções"
  );

  // produtos
  await createProduct({
    tenantId: tenant.id,
    name: "Coca-Cola Lata 350ml",
    description: "Refrigerante",
    price: "6.00",
    cost: "3.00",
    stock: 120,
    categoryId: bebidas.id,
    barcode: "7894900010015",
  });

  await createProduct({
    tenantId: tenant.id,
    name: "Heineken Long Neck 330ml",
    description: "Cerveja",
    price: "12.00",
    cost: "7.00",
    stock: 80,
    categoryId: bebidas.id,
  });

  await createProduct({
    tenantId: tenant.id,
    name: "Caipirinha Clássica",
    description: "Cachaça + limão + açúcar",
    price: "18.00",
    cost: "8.00",
    stock: 9999,
    categoryId: drinks.id,
  });

  await createProduct({
    tenantId: tenant.id,
    name: "Batata Frita",
    description: "Porção 300g",
    price: "22.00",
    cost: "10.00",
    stock: 40,
    categoryId: comidas.id,
  });

  log.ok(`Tenant ${tenantName} semeado.`);
  return { tenant };
}

async function main() {
  // Limpa dados (DEV!)
  log.info("Limpando dados...");
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.financialTransaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.userTenant.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany(); // zera tudo (inclui superadmin)

  // Superadmin global
  log.info("Criando SUPERADMIN...");
  const superadmin = await upsertUser(
    "superadmin@ezpdv.com",
    "Super Admin",
    "123456",
    SystemRole.SUPERADMIN
  );
  log.ok(`SUPERADMIN: ${superadmin.email}`);

  // Tenants
  await seedTenantFull({
    tenantName: "Restaurante Demo Centro",
    slug: "demo-centro",
    ownerEmail: "owner.centro@restaurante.com",
    ownerName: "Dono Centro",
    managerEmail: "manager.centro@restaurante.com",
    managerName: "Gerente Centro",
    waiterEmail: "waiter.centro@restaurante.com",
    waiterName: "Atendente Centro",
  });

  await seedTenantFull({
    tenantName: "Bar da Esquina",
    slug: "bar-esquina",
    ownerEmail: "owner.esquina@restaurante.com",
    ownerName: "Dono Esquina",
    managerEmail: "manager.esquina@restaurante.com",
    managerName: "Gerente Esquina",
    waiterEmail: "waiter.esquina@restaurante.com",
    waiterName: "Atendente Esquina",
  });

  await seedTenantFull({
    tenantName: "Churrascaria Avenida",
    slug: "churrascaria-avenida",
    ownerEmail: "owner.avenida@restaurante.com",
    ownerName: "Dono Avenida",
    managerEmail: "manager.avenida@restaurante.com",
    managerName: "Gerente Avenida",
    waiterEmail: "waiter.avenida@restaurante.com",
    waiterName: "Atendente Avenida",
  });

  log.ok("Seed concluído ✅");
}

main()
  .catch((e) => {
    log.err(JSON.stringify(e, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
