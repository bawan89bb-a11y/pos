import { sql } from "drizzle-orm";
import { rows } from "./sql";

/** All money in these results is integer cents unless noted otherwise. Non-void sales only. */

export interface SummaryTiles {
  netSales: number;
  avgSale: number;
  itemsSold: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  taxCollected: number;
}

export async function summaryTiles(from: number, to: number): Promise<SummaryTiles> {
  const [salesRow] = await rows<any>(sql`
    SELECT
      COALESCE(SUM(s.total),0) AS gross_total,
      COALESCE(SUM(s.subtotal),0) AS gross_subtotal,
      COALESCE((SELECT SUM(r.amount) FROM refunds r JOIN sales s2 ON s2.id = r.sale_id WHERE s2.ts >= ${from} AND s2.ts < ${to} AND s2.status <> 'void'),0) AS refunded_total,
      COUNT(*) AS sale_count,
      COALESCE(SUM(s.tax),0) AS tax_collected
    FROM sales s
    WHERE s.ts >= ${from} AND s.ts < ${to} AND s.status <> 'void'
  `);

  // per-line sum (never per-sale) — a sale with 3 lines must not multiply its subtotal by 3
  const [itemsRow] = await rows<any>(sql`
    SELECT COALESCE(SUM(sl.qty),0) AS items_sold,
           COALESCE(SUM(p.cost * sl.qty),0) AS cogs
    FROM sale_lines sl
    JOIN sales s ON s.id = sl.sale_id
    LEFT JOIN products p ON p.id = sl.product_id
    WHERE s.ts >= ${from} AND s.ts < ${to} AND s.status <> 'void'
  `);

  const [expenseRow] = await rows<any>(sql`
    SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE ts >= ${from} AND ts < ${to}
  `);

  const netSales = Number(salesRow.gross_total) - Number(salesRow.refunded_total);
  const saleCount = Number(salesRow.sale_count);
  const avgSale = saleCount > 0 ? Math.round(netSales / saleCount) : 0;
  const cogs = Number(itemsRow.cogs);
  const grossProfit = Number(salesRow.gross_subtotal) - cogs;
  const totalExpenses = Number(expenseRow.total);
  const netProfit = grossProfit - totalExpenses;

  return {
    netSales,
    avgSale,
    itemsSold: Number(itemsRow.items_sold),
    grossProfit,
    totalExpenses,
    netProfit,
    taxCollected: Number(salesRow.tax_collected),
  };
}

export interface Bucket {
  label: string;
  ts: number;
  sales: number;
  count: number;
}

/** hourly for a single day, daily normally, weekly beyond 70 days */
export async function netSalesByBucket(
  from: number,
  to: number
): Promise<{ granularity: "hour" | "day" | "week"; buckets: Bucket[] }> {
  const spanDays = (to - from) / 86400000;
  const granularity: "hour" | "day" | "week" = spanDays <= 1.5 ? "hour" : spanDays > 70 ? "week" : "day";

  const bucketMs = granularity === "hour" ? 3600000 : granularity === "day" ? 86400000 : 7 * 86400000;

  const saleRows = await rows<{ ts: number; total: number }>(sql`
    SELECT s.ts AS ts, s.total AS total
    FROM sales s
    WHERE s.ts >= ${from} AND s.ts < ${to} AND s.status <> 'void'
  `);

  const buckets = new Map<number, { sales: number; count: number }>();
  for (let t = from; t < to; t += bucketMs) buckets.set(t, { sales: 0, count: 0 });

  for (const row of saleRows) {
    const bucketStart = from + Math.floor((Number(row.ts) - from) / bucketMs) * bucketMs;
    const b = buckets.get(bucketStart);
    if (b) {
      b.sales += Number(row.total);
      b.count += 1;
    }
  }

  const result: Bucket[] = [...buckets.entries()].map(([ts, b]) => ({
    ts,
    label: bucketLabel(ts, granularity),
    sales: b.sales,
    count: b.count,
  }));
  return { granularity, buckets: result };
}

function bucketLabel(ts: number, granularity: "hour" | "day" | "week"): string {
  const d = new Date(ts);
  if (granularity === "hour") {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "Asia/Baghdad" }).format(d);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Baghdad" }).format(d);
}

export async function paymentMix(from: number, to: number) {
  const result = await rows<{ method: string; total: number }>(sql`
    SELECT sp.method AS method, SUM(sp.amount) AS total
    FROM sale_payments sp
    JOIN sales s ON s.id = sp.sale_id
    WHERE s.ts >= ${from} AND s.ts < ${to} AND s.status <> 'void'
    GROUP BY sp.method
  `);
  return result.map((r) => ({ method: r.method, total: Number(r.total) }));
}

export async function expensesByType(from: number, to: number) {
  const result = await rows<{ id: string; name: string; color: string; total: number; count: number }>(sql`
    SELECT et.id AS id, et.name AS name, et.color AS color, COALESCE(SUM(e.amount),0) AS total, COUNT(e.id) AS count
    FROM expense_types et
    LEFT JOIN expenses e ON e.type_id = et.id AND e.ts >= ${from} AND e.ts < ${to}
    GROUP BY et.id, et.name, et.color
    ORDER BY total DESC
  `);
  return result.map((r) => ({ ...r, total: Number(r.total), count: Number(r.count) }));
}

export async function topProductsByRevenue(from: number, to: number, limit = 10) {
  const result = await rows<{ name: string; sku: string; revenue: number; qty: number }>(sql`
    SELECT sl.name AS name, sl.sku AS sku,
      SUM(ROUND(sl.unit_price * sl.qty * (1 - sl.discount_pct/100))) AS revenue,
      SUM(sl.qty) AS qty
    FROM sale_lines sl
    JOIN sales s ON s.id = sl.sale_id
    WHERE s.ts >= ${from} AND s.ts < ${to} AND s.status <> 'void'
    GROUP BY sl.name, sl.sku
    ORDER BY revenue DESC
    LIMIT ${limit}
  `);
  return result.map((r) => ({ ...r, revenue: Number(r.revenue), qty: Number(r.qty) }));
}

export async function cashiersRanking(from: number, to: number) {
  const result = await rows<{ id: string; name: string; total: number; count: number }>(sql`
    SELECT u.id AS id, u.name AS name, COALESCE(SUM(s.total),0) AS total, COUNT(s.id) AS count
    FROM users u
    LEFT JOIN sales s ON s.user_id = u.id AND s.ts >= ${from} AND s.ts < ${to} AND s.status <> 'void'
    GROUP BY u.id, u.name
    HAVING total > 0
    ORDER BY total DESC
  `);
  return result.map((r) => ({ ...r, total: Number(r.total), count: Number(r.count) }));
}

export async function bestProductsByRevenue(from: number, to: number, limit = 5) {
  return topProductsByRevenue(from, to, limit);
}
