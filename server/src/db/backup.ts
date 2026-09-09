import { eq } from "drizzle-orm";
import { db, schema } from "./client";
import { seedDemoData } from "./seedData";

const BUSINESS_TABLES = [
  "settings",
  "brands",
  "suppliers",
  "products",
  "customers",
  "accountPayments",
  "sales",
  "saleLines",
  "salePayments",
  "refunds",
  "expenseTypes",
  "expenses",
  "quickKeyLayouts",
  "carts",
] as const;

export async function exportBackup() {
  const [
    settingsRows,
    brands,
    suppliers,
    products,
    customers,
    accountPayments,
    sales,
    saleLines,
    salePayments,
    refunds,
    expenseTypes,
    expenses,
    quickKeyLayouts,
    carts,
  ] = await Promise.all([
    db.select().from(schema.settings),
    db.select().from(schema.brands),
    db.select().from(schema.suppliers),
    db.select().from(schema.products),
    db.select().from(schema.customers),
    db.select().from(schema.accountPayments),
    db.select().from(schema.sales),
    db.select().from(schema.saleLines),
    db.select().from(schema.salePayments),
    db.select().from(schema.refunds),
    db.select().from(schema.expenseTypes),
    db.select().from(schema.expenses),
    db.select().from(schema.quickKeyLayouts),
    db.select().from(schema.carts),
  ]);

  return {
    exportedAt: Date.now(),
    settings: settingsRows[0] ?? null,
    brands,
    suppliers,
    products,
    customers,
    accountPayments,
    sales,
    saleLines,
    salePayments,
    refunds,
    expenseTypes,
    expenses,
    quickKeyLayouts,
    carts,
  };
}

export type Backup = Awaited<ReturnType<typeof exportBackup>>;

export async function recordCounts() {
  const backup = await exportBackup();
  const counts: Record<string, number> = {};
  for (const key of BUSINESS_TABLES) {
    if (key === "settings") continue;
    const value = (backup as any)[key];
    counts[key] = Array.isArray(value) ? value.length : 0;
  }
  return counts;
}

/** Wipes and replaces every business table (never users/sessions) inside one transaction. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(schema.refunds);
    await tx.delete(schema.salePayments);
    await tx.delete(schema.saleLines);
    await tx.delete(schema.sales);
    await tx.delete(schema.carts);
    await tx.delete(schema.accountPayments);
    await tx.delete(schema.expenses);
    await tx.delete(schema.expenseTypes);
    await tx.delete(schema.quickKeyLayouts);
    await tx.delete(schema.customers);
    await tx.delete(schema.products);
    await tx.delete(schema.brands);
    await tx.delete(schema.suppliers);

    if (backup.settings) await tx.update(schema.settings).set(backup.settings).where(eq(schema.settings.id, 1));
    if (backup.brands.length) await tx.insert(schema.brands).values(backup.brands);
    if (backup.suppliers.length) await tx.insert(schema.suppliers).values(backup.suppliers);
    if (backup.products.length) await tx.insert(schema.products).values(backup.products);
    if (backup.customers.length) await tx.insert(schema.customers).values(backup.customers);
    if (backup.accountPayments.length) await tx.insert(schema.accountPayments).values(backup.accountPayments);
    if (backup.sales.length) await tx.insert(schema.sales).values(backup.sales.map(({ seq, ...s }: any) => s));
    if (backup.saleLines.length) await tx.insert(schema.saleLines).values(backup.saleLines);
    if (backup.salePayments.length) await tx.insert(schema.salePayments).values(backup.salePayments);
    if (backup.refunds.length) await tx.insert(schema.refunds).values(backup.refunds);
    if (backup.expenseTypes.length) await tx.insert(schema.expenseTypes).values(backup.expenseTypes);
    if (backup.expenses.length) await tx.insert(schema.expenses).values(backup.expenses);
    if (backup.quickKeyLayouts.length) await tx.insert(schema.quickKeyLayouts).values(backup.quickKeyLayouts);
    if (backup.carts.length) await tx.insert(schema.carts).values(backup.carts);
  });
}

export async function resetDemoData(): Promise<void> {
  await seedDemoData();
}
