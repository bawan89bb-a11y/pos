import { baghdadDayStart } from "./time";

export interface CalcLine {
  unitPrice: number; // cents
  qty: number;
  discountPct: number; // 0-100
  taxable: boolean;
}

export function lineNet(line: CalcLine): number {
  return Math.round(line.unitPrice * line.qty * (1 - line.discountPct / 100));
}

export interface CartTotals {
  afterLineDiscounts: number;
  cartDiscount: number;
  subtotal: number;
  taxableBase: number;
  tax: number;
  total: number;
}

/**
 * The cart discount is spread proportionally across lines so tax applies only
 * to the discounted taxable portion.
 */
export function computeCartTotals(
  lines: CalcLine[],
  cartDiscountPct: number,
  taxRate: number
): CartTotals {
  const afterLineDiscounts = lines.reduce((sum, l) => sum + lineNet(l), 0);
  const cartDiscount = Math.round(afterLineDiscounts * (cartDiscountPct / 100));
  const subtotal = afterLineDiscounts - cartDiscount;

  const taxableLineSum = lines
    .filter((l) => l.taxable)
    .reduce((sum, l) => sum + lineNet(l), 0);

  const taxableBase =
    afterLineDiscounts > 0
      ? taxableLineSum * (subtotal / afterLineDiscounts)
      : 0;
  const tax = Math.round(taxableBase * taxRate);
  const total = subtotal + tax;

  return { afterLineDiscounts, cartDiscount, subtotal, taxableBase, tax, total };
}

export function markupPct(cost: number, price: number): number | null {
  if (cost <= 0) return null;
  return ((price - cost) / cost) * 100;
}

export function marginPct(cost: number, price: number): number | null {
  if (price <= 0) return null;
  return ((price - cost) / price) * 100;
}

export function priceFromTargetMargin(cost: number, targetMarginPct: number): number {
  return Math.round(cost / (1 - targetMarginPct / 100));
}

export function saleBalance(total: number, paymentsSum: number, change: number): number {
  return total - paymentsSum + change;
}

export function cogs(lines: { cost: number; qty: number }[]): number {
  return lines.reduce((sum, l) => sum + l.cost * l.qty, 0);
}

export type ExpiryLevel = "none" | "expired" | "urgent" | "warn" | "ok";

export function expiryLevel(
  expiryDate: string | null | undefined,
  now: number,
  warnMonths: number,
  urgentMonths: number
): ExpiryLevel {
  if (!expiryDate) return "none";
  const [y, m, d] = expiryDate.split("-").map(Number);
  const expiryMidnight = Date.UTC(y, m - 1, d);
  const todayMidnight = baghdadDayStart(now);
  const daysDiff = Math.round((expiryMidnight - todayMidnight) / 86400000);

  if (daysDiff < 0) return "expired";
  const urgentDays = urgentMonths * 30;
  const warnDays = warnMonths * 30;
  if (daysDiff <= urgentDays) return "urgent";
  if (daysDiff <= warnDays) return "warn";
  return "ok";
}

export function expiryLabel(
  expiryDate: string | null | undefined,
  now: number
): string {
  if (!expiryDate) return "—";
  const [y, m, d] = expiryDate.split("-").map(Number);
  const expiryMidnight = Date.UTC(y, m - 1, d);
  const todayMidnight = baghdadDayStart(now);
  const daysDiff = Math.round((expiryMidnight - todayMidnight) / 86400000);

  if (daysDiff < 0) return `Expired ${Math.abs(daysDiff)}d ago`;
  if (daysDiff === 0) return "Expires today";
  if (daysDiff < 45) return `${daysDiff} days`;
  const months = Math.round(daysDiff / 30);
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function availableToSell(stock: number, parkedQty: number): number {
  return stock - parkedQty;
}
