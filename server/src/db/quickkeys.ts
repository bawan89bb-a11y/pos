import { eq } from "drizzle-orm";
import { db, schema } from "./client";
import { newId } from "./ids";
import type { QuickKeyLayout, QuickKeyPage } from "@thoth/shared";

function rowToLayout(row: typeof schema.quickKeyLayouts.$inferSelect): QuickKeyLayout {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    pages: row.pages as QuickKeyPage[],
  };
}

export async function listLayouts(): Promise<QuickKeyLayout[]> {
  const rows = await db.select().from(schema.quickKeyLayouts).orderBy(schema.quickKeyLayouts.createdAt);
  return rows.map(rowToLayout);
}

export async function getLayout(id: string): Promise<QuickKeyLayout | null> {
  const [row] = await db.select().from(schema.quickKeyLayouts).where(eq(schema.quickKeyLayouts.id, id));
  return row ? rowToLayout(row) : null;
}

function emptyPage(name: string): QuickKeyPage {
  return { id: newId("qkp"), name, keys: Array(20).fill(null) };
}

export async function createLayout(name: string): Promise<QuickKeyLayout> {
  const id = newId("qkl");
  const createdAt = Date.now();
  const pages = [emptyPage("Page 1")];
  await db.insert(schema.quickKeyLayouts).values({ id, name, createdAt, pages });
  return { id, name, createdAt, pages };
}

export async function copyLayout(id: string): Promise<QuickKeyLayout> {
  const existing = await getLayout(id);
  if (!existing) throw new Error("Layout not found");
  const newLayoutId = newId("qkl");
  const createdAt = Date.now();
  const pages = existing.pages.map((p) => ({ ...p, id: newId("qkp") }));
  const name = `${existing.name} copy`;
  await db.insert(schema.quickKeyLayouts).values({ id: newLayoutId, name, createdAt, pages });
  return { id: newLayoutId, name, createdAt, pages };
}

export async function updateLayout(
  id: string,
  patch: { name?: string; pages?: QuickKeyPage[] }
): Promise<QuickKeyLayout> {
  const update: Partial<typeof schema.quickKeyLayouts.$inferInsert> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.pages !== undefined) update.pages = patch.pages;
  await db.update(schema.quickKeyLayouts).set(update).where(eq(schema.quickKeyLayouts.id, id));
  return (await getLayout(id))!;
}

export async function deleteLayout(id: string): Promise<void> {
  await db.delete(schema.quickKeyLayouts).where(eq(schema.quickKeyLayouts.id, id));
}
