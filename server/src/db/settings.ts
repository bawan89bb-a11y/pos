import { eq } from "drizzle-orm";
import { db, schema } from "./client";
import type { Settings } from "@thoth/shared";

function rowToSettings(row: typeof schema.settings.$inferSelect): Settings {
  return {
    store: row.store,
    addr: row.addr,
    phone: row.phone,
    email: row.email,
    logo: row.logo,
    currency: row.currency,
    taxRate: Number(row.taxRate),
    receiptFooter: row.receiptFooter,
    invoiceTitle: row.invoiceTitle,
    showLogoOnInvoice: row.showLogoOnInvoice,
    docFormat: row.docFormat,
    quickKeys: row.quickKeys,
    activeLayoutId: row.activeLayoutId,
    expiryWarnMonths: row.expiryWarnMonths,
    expiryUrgentMonths: row.expiryUrgentMonths,
  };
}

export async function getSettings(): Promise<Settings> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
  if (!row) {
    await db.insert(schema.settings).values({ id: 1 });
    const [created] = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
    return rowToSettings(created);
  }
  return rowToSettings(row);
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  await getSettings(); // ensure row exists
  const update: Partial<typeof schema.settings.$inferInsert> = { ...patch } as any;
  if (patch.taxRate !== undefined) update.taxRate = String(patch.taxRate) as any;
  await db.update(schema.settings).set(update).where(eq(schema.settings.id, 1));
  return getSettings();
}
