import { and, desc, eq, gte, lt, sql, like, or, inArray } from "drizzle-orm";
import { db, schema } from "./client";
import { newId } from "./ids";
import { computeCartTotals, type CalcLine } from "@thoth/shared";
import type { Sale, Payment, CartLine, Cart } from "@thoth/shared";

export interface SaleLineInput {
  productId: string;
  qty: number;
  discountPct: number;
}

export interface PaymentInput {
  method: "cash" | "card" | "gift";
  amount: number;
  ref?: string;
}

export interface CreateSaleInput {
  userId: string;
  customerId?: string | null;
  lines: SaleLineInput[];
  discountPct: number;
  note?: string;
  payments: PaymentInput[];
  putOnAccount?: boolean; // if true, any unpaid remainder is charged to the customer
}

export interface SaleWithDetails extends Sale {
  cashierName?: string;
  customerName?: string;
}

async function rowsToSale(
  sale: typeof schema.sales.$inferSelect,
  lines: (typeof schema.saleLines.$inferSelect)[],
  payments: (typeof schema.salePayments.$inferSelect)[],
  refunds: (typeof schema.refunds.$inferSelect)[]
): Promise<Sale> {
  return {
    id: sale.id,
    no: sale.no,
    ts: sale.ts,
    userId: sale.userId,
    customerId: sale.customerId,
    lines: lines
      .sort((a, b) => a.lineIndex - b.lineIndex)
      .map((l) => ({
        productId: l.productId ?? "",
        name: l.name,
        sku: l.sku,
        unitPrice: l.unitPrice,
        qty: l.qty,
        discountPct: l.discountPct,
        taxable: l.taxable,
      })),
    discountPct: sale.discountPct,
    subtotal: sale.subtotal,
    discount: sale.discount,
    tax: sale.tax,
    total: sale.total,
    payments: payments.map((p) => ({ method: p.method, amount: p.amount, ref: p.ref })),
    change: sale.change,
    onAccount: sale.onAccount,
    status: sale.status,
    refunds: refunds.map((r) => ({ ts: r.ts, amount: r.amount, reason: r.reason, restock: r.restock })),
    note: sale.note,
    voidReason: sale.voidReason,
    voidedAt: sale.voidedAt,
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export async function getSale(id: string, executor: Executor = db): Promise<Sale | null> {
  const [sale] = await executor.select().from(schema.sales).where(eq(schema.sales.id, id));
  if (!sale) return null;
  const [lines, payments, refunds] = await Promise.all([
    executor.select().from(schema.saleLines).where(eq(schema.saleLines.saleId, id)),
    executor.select().from(schema.salePayments).where(eq(schema.salePayments.saleId, id)),
    executor.select().from(schema.refunds).where(eq(schema.refunds.saleId, id)),
  ]);
  return rowsToSale(sale, lines, payments, refunds);
}

export interface SaleFilters {
  from?: number;
  to?: number; // exclusive
  customerId?: string;
  search?: string; // receipt no, note, or product name
}

export async function listSales(filters: SaleFilters = {}): Promise<Sale[]> {
  const clauses = [];
  if (filters.from !== undefined) clauses.push(gte(schema.sales.ts, filters.from));
  if (filters.to !== undefined) clauses.push(lt(schema.sales.ts, filters.to));
  if (filters.customerId) clauses.push(eq(schema.sales.customerId, filters.customerId));

  let saleRows = await db
    .select()
    .from(schema.sales)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(schema.sales.ts));

  if (filters.search) {
    const s = `%${filters.search}%`;
    const matchingLineSaleIds = new Set(
      (
        await db
          .select({ saleId: schema.saleLines.saleId })
          .from(schema.saleLines)
          .where(like(schema.saleLines.name, s))
      ).map((r) => r.saleId)
    );
    const needle = filters.search.toLowerCase();
    saleRows = saleRows.filter(
      (s2) =>
        s2.no.toLowerCase().includes(needle) ||
        s2.note.toLowerCase().includes(needle) ||
        matchingLineSaleIds.has(s2.id)
    );
  }

  const saleIds = saleRows.map((s) => s.id);
  if (!saleIds.length) return [];

  const [allLines, allPayments, allRefunds] = await Promise.all([
    db.select().from(schema.saleLines),
    db.select().from(schema.salePayments),
    db.select().from(schema.refunds),
  ]);
  const linesBySale = groupBy(allLines, (l) => l.saleId);
  const paymentsBySale = groupBy(allPayments, (p) => p.saleId);
  const refundsBySale = groupBy(allRefunds, (r) => r.saleId);

  return Promise.all(
    saleRows.map((s) =>
      rowsToSale(
        s,
        linesBySale.get(s.id) ?? [],
        paymentsBySale.get(s.id) ?? [],
        refundsBySale.get(s.id) ?? []
      )
    )
  );
}

function groupBy<T, K>(arr: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

/**
 * Recomputes every total from live product prices inside a transaction (never trusts
 * client-supplied prices), decrements stock, assigns the sequential sale number, and
 * applies any on-account remainder to the customer's balance.
 */
export async function createSale(input: CreateSaleInput): Promise<Sale> {
  if (!input.lines.length) throw new Error("Cannot ring up an empty cart");

  return db.transaction(async (tx) => {
    const productIds = input.lines.map((l) => l.productId);
    const products = await tx
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, productIds))
      .for("update");
    const byId = new Map(products.map((p) => [p.id, p]));

    const calcLines: (CalcLine & { productId: string; name: string; sku: string; unitPrice: number })[] =
      input.lines.map((l) => {
        const product = byId.get(l.productId);
        if (!product) throw new Error(`Product ${l.productId} not found`);
        return {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.price,
          qty: l.qty,
          discountPct: l.discountPct,
          taxable: product.taxable,
        };
      });

    const settingsRow = await tx.select().from(schema.settings).where(eq(schema.settings.id, 1));
    const taxRate = settingsRow[0] ? Number(settingsRow[0].taxRate) : 0;

    const totals = computeCartTotals(calcLines, input.discountPct, taxRate);
    const paymentsSum = input.payments.reduce((sum, p) => sum + p.amount, 0);

    let onAccount = 0;
    let change = 0;
    if (paymentsSum >= totals.total) {
      change = paymentsSum - totals.total;
    } else {
      const remainder = totals.total - paymentsSum;
      if (input.putOnAccount && input.customerId) {
        onAccount = remainder;
      } else if (remainder > 0) {
        throw new Error("Payment does not cover the total; put the remainder on account or add more tenders");
      }
    }

    const id = newId("sal");
    const ts = Date.now();
    await tx.insert(schema.sales).values({
      id,
      no: "#0", // patched below once we know the seq
      ts,
      userId: input.userId,
      customerId: input.customerId ?? null,
      discountPct: input.discountPct,
      subtotal: totals.subtotal,
      discount: totals.cartDiscount,
      tax: totals.tax,
      total: totals.total,
      change,
      onAccount,
      status: onAccount > 0 ? "partial" : "completed",
      note: input.note ?? "",
      voidReason: "",
      voidedAt: null,
    });

    const [saved] = await tx.select().from(schema.sales).where(eq(schema.sales.id, id));
    const no = `#${1000 + saved.seq}`;
    await tx.update(schema.sales).set({ no }).where(eq(schema.sales.id, id));

    await tx.insert(schema.saleLines).values(
      calcLines.map((l, i) => ({
        id: newId("sln"),
        saleId: id,
        lineIndex: i,
        productId: l.productId,
        name: l.name,
        sku: l.sku,
        unitPrice: l.unitPrice,
        qty: l.qty,
        discountPct: l.discountPct,
        taxable: l.taxable,
      }))
    );

    if (input.payments.length) {
      await tx.insert(schema.salePayments).values(
        input.payments.map((p) => ({
          id: newId("pay"),
          saleId: id,
          method: p.method,
          amount: p.amount,
          ref: p.ref ?? "",
        }))
      );
    }

    for (const l of calcLines) {
      await tx
        .update(schema.products)
        .set({ stock: sql`${schema.products.stock} - ${l.qty}` })
        .where(eq(schema.products.id, l.productId));
    }

    if (onAccount > 0 && input.customerId) {
      await tx
        .update(schema.customers)
        .set({ balance: sql`${schema.customers.balance} - ${onAccount}` })
        .where(eq(schema.customers.id, input.customerId));
    }

    return (await getSale(id, tx))!;
  });
}

export interface RefundInput {
  saleId: string;
  amount: number;
  reason: string;
  restock: boolean;
  restockLines?: { productId: string; qty: number }[];
}

export async function refundSale(input: RefundInput): Promise<Sale> {
  return db.transaction(async (tx) => {
    const [sale] = await tx.select().from(schema.sales).where(eq(schema.sales.id, input.saleId));
    if (!sale) throw new Error("Sale not found");
    if (sale.status === "void") throw new Error("Cannot refund a voided sale");

    const priorRefunds = await tx
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.saleId, input.saleId));
    const alreadyRefunded = priorRefunds.reduce((sum, r) => sum + r.amount, 0);
    const remaining = sale.total - alreadyRefunded;
    const amount = Math.max(0, Math.min(input.amount, remaining));
    if (amount <= 0) throw new Error("Nothing left to refund on this sale");

    await tx.insert(schema.refunds).values({
      id: newId("ref"),
      saleId: input.saleId,
      ts: Date.now(),
      amount,
      reason: input.reason,
      restock: input.restock,
    });

    if (input.restock && input.restockLines?.length) {
      for (const l of input.restockLines) {
        await tx
          .update(schema.products)
          .set({ stock: sql`${schema.products.stock} + ${l.qty}` })
          .where(eq(schema.products.id, l.productId));
      }
    }

    const totalRefunded = alreadyRefunded + amount;
    const status = totalRefunded >= sale.total ? "refunded" : "partial";
    await tx.update(schema.sales).set({ status }).where(eq(schema.sales.id, input.saleId));

    return (await getSale(input.saleId, tx))!;
  });
}

export async function voidSale(saleId: string, reason: string): Promise<Sale> {
  return db.transaction(async (tx) => {
    const [sale] = await tx.select().from(schema.sales).where(eq(schema.sales.id, saleId));
    if (!sale) throw new Error("Sale not found");
    if (sale.status === "void") return (await getSale(saleId, tx))!;

    const lines = await tx.select().from(schema.saleLines).where(eq(schema.saleLines.saleId, saleId));
    for (const l of lines) {
      if (!l.productId) continue;
      await tx
        .update(schema.products)
        .set({ stock: sql`${schema.products.stock} + ${l.qty}` })
        .where(eq(schema.products.id, l.productId));
    }

    if (sale.onAccount > 0 && sale.customerId) {
      await tx
        .update(schema.customers)
        .set({ balance: sql`${schema.customers.balance} + ${sale.onAccount}` })
        .where(eq(schema.customers.id, sale.customerId));
    }

    await tx
      .update(schema.sales)
      .set({ status: "void", voidReason: reason, voidedAt: Date.now() })
      .where(eq(schema.sales.id, saleId));

    return (await getSale(saleId, tx))!;
  });
}

export async function payOnAccountBalance(saleId: string, amount: number): Promise<Sale> {
  const sale = await getSale(saleId);
  if (!sale) throw new Error("Sale not found");
  const paid = Math.min(amount, sale.onAccount);
  await db
    .update(schema.sales)
    .set({ onAccount: sale.onAccount - paid })
    .where(eq(schema.sales.id, saleId));
  return (await getSale(saleId))!;
}

export async function updateSaleNote(saleId: string, note: string): Promise<Sale> {
  await db.update(schema.sales).set({ note }).where(eq(schema.sales.id, saleId));
  return (await getSale(saleId))!;
}

// ---------- parked carts ----------
function rowToCart(row: typeof schema.carts.$inferSelect): Cart {
  return {
    id: row.id,
    lines: row.lines as CartLine[],
    customerId: row.customerId,
    discountPct: row.discountPct,
    note: row.note,
    parkedAt: row.parkedAt,
  };
}

export async function parkCart(input: {
  lines: CartLine[];
  customerId: string | null;
  discountPct: number;
  note: string;
  userId: string;
}): Promise<Cart> {
  const id = newId("crt");
  const parkedAt = Date.now();
  await db.insert(schema.carts).values({
    id,
    lines: input.lines,
    customerId: input.customerId,
    discountPct: input.discountPct,
    note: input.note,
    parkedAt,
    userId: input.userId,
  });
  return { id, lines: input.lines, customerId: input.customerId, discountPct: input.discountPct, note: input.note, parkedAt };
}

export async function listParkedCarts(): Promise<Cart[]> {
  const rows = await db.select().from(schema.carts).orderBy(desc(schema.carts.parkedAt));
  return rows.map(rowToCart);
}

export async function retrieveCart(id: string): Promise<Cart | null> {
  const [row] = await db.select().from(schema.carts).where(eq(schema.carts.id, id));
  if (!row) return null;
  await db.delete(schema.carts).where(eq(schema.carts.id, id));
  return rowToCart(row);
}

export async function parkedQtyByProduct(): Promise<Map<string, number>> {
  const rows = await db.select().from(schema.carts);
  const map = new Map<string, number>();
  for (const row of rows) {
    for (const line of row.lines as CartLine[]) {
      map.set(line.productId, (map.get(line.productId) ?? 0) + line.qty);
    }
  }
  return map;
}
