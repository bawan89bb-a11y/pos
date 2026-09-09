import { sql } from "drizzle-orm";
import { rows } from "./sql";
import { expiryLevel } from "@thoth/shared";

export interface NeedsAttention {
  lowStock: { id: string; name: string; sku: string; stock: number; lowAt: number }[];
  outOfStock: { id: string; name: string; sku: string }[];
  suppliersToReorder: { id: string; name: string; count: number }[];
  expiringSoon: { id: string; name: string; sku: string; expiry: string; level: string }[];
  parkedSales: { id: string; parkedAt: number; itemCount: number }[];
  expensesThisWeek: number;
}

export interface ExpiryAlert {
  id: string;
  name: string;
  sku: string;
  category: string;
  expiry: string;
  level: "expired" | "urgent" | "warn";
  stock: number;
  price: number;
  valueAtRisk: number;
}

export async function expiryAlerts(
  now: number,
  warnMonths: number,
  urgentMonths: number
): Promise<{ alerts: ExpiryAlert[]; expiredCount: number; urgentCount: number; warnCount: number }> {
  const products = await rows<{
    id: string;
    name: string;
    sku: string;
    category: string;
    expiry: string;
    expiryWarnMonths: number | null;
    stock: number;
    price: number;
  }>(sql`
    SELECT id, name, sku, category, expiry, expiry_warn_months AS expiryWarnMonths, stock, price
    FROM products
    WHERE active = 1 AND expiry IS NOT NULL AND expiry <> '' AND stock > 0
  `);

  const alerts: ExpiryAlert[] = [];
  for (const p of products) {
    const level = expiryLevel(p.expiry, now, p.expiryWarnMonths ?? warnMonths, urgentMonths);
    if (level !== "expired" && level !== "urgent" && level !== "warn") continue;
    alerts.push({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      expiry: p.expiry,
      level,
      stock: p.stock,
      price: p.price,
      valueAtRisk: p.stock * p.price,
    });
  }
  alerts.sort((a, b) => {
    const order = { expired: 0, urgent: 1, warn: 2 };
    return order[a.level] - order[b.level];
  });

  return {
    alerts,
    expiredCount: alerts.filter((a) => a.level === "expired").length,
    urgentCount: alerts.filter((a) => a.level === "urgent").length,
    warnCount: alerts.filter((a) => a.level === "warn").length,
  };
}

export async function needsAttention(
  now: number,
  warnMonths: number,
  urgentMonths: number
): Promise<NeedsAttention> {
  const lowStockRows = await rows<{ id: string; name: string; sku: string; stock: number; lowAt: number }>(sql`
    SELECT id, name, sku, stock, low_at AS lowAt
    FROM products
    WHERE active = 1 AND stock <= low_at AND stock > 0
    ORDER BY stock ASC
    LIMIT 10
  `);

  const outOfStockRows = await rows<{ id: string; name: string; sku: string }>(sql`
    SELECT id, name, sku FROM products WHERE active = 1 AND stock <= 0 ORDER BY name LIMIT 10
  `);

  const reorderRows = await rows<{ id: string; name: string; count: number }>(sql`
    SELECT s.id AS id, s.name AS name, COUNT(p.id) AS count
    FROM suppliers s
    JOIN products p ON p.supplier_id = s.id AND p.active = 1 AND p.stock <= p.low_at
    GROUP BY s.id, s.name
    ORDER BY count DESC
  `);

  const expiryCandidates = await rows<{
    id: string;
    name: string;
    sku: string;
    expiry: string;
    expiryWarnMonths: number | null;
  }>(sql`
    SELECT id, name, sku, expiry, expiry_warn_months AS expiryWarnMonths
    FROM products
    WHERE active = 1 AND expiry IS NOT NULL AND expiry <> '' AND stock > 0
  `);
  const expiringSoon = expiryCandidates
    .map((p) => ({
      ...p,
      level: expiryLevel(p.expiry, now, p.expiryWarnMonths ?? warnMonths, urgentMonths),
    }))
    .filter((p) => p.level === "expired" || p.level === "urgent" || p.level === "warn")
    .slice(0, 10);

  const parkedRows = await rows<{ id: string; parkedAt: number; itemCount: number }>(sql`
    SELECT id, parked_at AS parkedAt, JSON_LENGTH(\`lines\`) AS itemCount FROM carts ORDER BY parked_at DESC LIMIT 10
  `);

  const weekAgo = now - 7 * 86400000;
  const [expenseRow] = await rows<{ total: number }>(sql`
    SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE ts >= ${weekAgo} AND ts <= ${now}
  `);

  return {
    lowStock: lowStockRows,
    outOfStock: outOfStockRows,
    suppliersToReorder: reorderRows,
    expiringSoon: expiringSoon.map(({ expiryWarnMonths, ...r }) => r),
    parkedSales: parkedRows,
    expensesThisWeek: Number(expenseRow.total),
  };
}
