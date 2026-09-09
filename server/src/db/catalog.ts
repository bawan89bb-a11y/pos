import { and, eq, like, or, sql, desc, asc, inArray } from "drizzle-orm";
import { db, schema } from "./client";
import { newId } from "./ids";
import type { Brand, Supplier, Product } from "@thoth/shared";

// ---------- brands ----------
export async function listBrands(): Promise<Brand[]> {
  return db.select().from(schema.brands).orderBy(schema.brands.name);
}

export async function createBrand(input: { name: string; note?: string }): Promise<Brand> {
  const id = newId("brd");
  await db.insert(schema.brands).values({ id, name: input.name, note: input.note ?? "", active: true });
  const [row] = await db.select().from(schema.brands).where(eq(schema.brands.id, id));
  return row;
}

export async function updateBrand(id: string, patch: Partial<Brand>): Promise<Brand> {
  await db.update(schema.brands).set(patch).where(eq(schema.brands.id, id));
  const [row] = await db.select().from(schema.brands).where(eq(schema.brands.id, id));
  return row;
}

export async function deleteBrand(id: string): Promise<void> {
  // clears the brand from its products rather than deleting them
  await db.update(schema.products).set({ brandId: null }).where(eq(schema.products.brandId, id));
  await db.delete(schema.brands).where(eq(schema.brands.id, id));
}

// ---------- suppliers ----------
export async function listSuppliers(): Promise<Supplier[]> {
  return db.select().from(schema.suppliers).orderBy(schema.suppliers.name);
}

export async function createSupplier(input: Omit<Supplier, "id" | "active">): Promise<Supplier> {
  const id = newId("sup");
  await db.insert(schema.suppliers).values({ id, ...input, active: true });
  const [row] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id));
  return row;
}

export async function updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier> {
  await db.update(schema.suppliers).set(patch).where(eq(schema.suppliers.id, id));
  const [row] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id));
  return row;
}

export async function deleteSupplier(id: string): Promise<void> {
  await db.update(schema.products).set({ supplierId: null }).where(eq(schema.products.supplierId, id));
  await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));
}

// ---------- products ----------
export interface ProductFilters {
  search?: string;
  supplierId?: string;
  brandId?: string;
  status?: "active" | "inactive" | "all";
  expiry?: "any" | "expiringSoon" | "expired" | "noDate";
  warnMonths?: number;
  urgentMonths?: number;
}

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const clauses = [];
  if (filters.search) {
    const s = `%${filters.search}%`;
    clauses.push(
      or(
        like(schema.products.name, s),
        like(schema.products.sku, s),
        like(schema.products.category, s)
      )
    );
  }
  if (filters.supplierId) clauses.push(eq(schema.products.supplierId, filters.supplierId));
  if (filters.brandId) clauses.push(eq(schema.products.brandId, filters.brandId));
  if (!filters.status || filters.status === "active") clauses.push(eq(schema.products.active, true));
  else if (filters.status === "inactive") clauses.push(eq(schema.products.active, false));

  const rows = await db
    .select()
    .from(schema.products)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(schema.products.createdAt));

  let result = rows as unknown as Product[];

  if (filters.expiry && filters.expiry !== "any") {
    const now = Date.now();
    const { expiryLevel } = await import("@thoth/shared");
    const warnMonths = filters.warnMonths ?? 6;
    const urgentMonths = filters.urgentMonths ?? 3;
    result = result.filter((p) => {
      const level = expiryLevel(
        p.expiry,
        now,
        p.expiryWarnMonths ?? warnMonths,
        urgentMonths
      );
      if (filters.expiry === "noDate") return level === "none";
      if (filters.expiry === "expired") return level === "expired";
      if (filters.expiry === "expiringSoon") return level === "urgent" || level === "warn";
      return true;
    });
  }

  return result;
}

export async function getProduct(id: string): Promise<Product | null> {
  const [row] = await db.select().from(schema.products).where(eq(schema.products.id, id));
  return (row as unknown as Product) ?? null;
}

export async function createProduct(
  input: Omit<Product, "id" | "createdAt">
): Promise<Product> {
  const existing = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.sku, input.sku))
    .limit(1);
  if (existing.length) throw new Error(`SKU "${input.sku}" is already in use`);

  const id = newId("prd");
  await db.insert(schema.products).values({ id, ...input, createdAt: Date.now() });
  return (await getProduct(id))!;
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  if (patch.sku) {
    const existing = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.sku, patch.sku))
      .limit(1);
    if (existing.length && existing[0].id !== id) throw new Error(`SKU "${patch.sku}" is already in use`);
  }
  await db.update(schema.products).set(patch as any).where(eq(schema.products.id, id));
  return (await getProduct(id))!;
}

export async function bulkSetProductsActive(ids: string[], active: boolean): Promise<void> {
  if (!ids.length) return;
  await db.update(schema.products).set({ active }).where(inArray(schema.products.id, ids));
}

export async function bulkDeleteProducts(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.delete(schema.products).where(inArray(schema.products.id, ids));
}

export async function findOrCreateBrand(name: string): Promise<string> {
  if (!name.trim()) return "";
  const [existing] = await db.select().from(schema.brands).where(eq(schema.brands.name, name)).limit(1);
  if (existing) return existing.id;
  const created = await createBrand({ name });
  return created.id;
}

export async function findOrCreateSupplier(name: string): Promise<string> {
  if (!name.trim()) return "";
  const [existing] = await db
    .select()
    .from(schema.suppliers)
    .where(eq(schema.suppliers.name, name))
    .limit(1);
  if (existing) return existing.id;
  const created = await createSupplier({ name, contact: "", phone: "", email: "", note: "" });
  return created.id;
}
