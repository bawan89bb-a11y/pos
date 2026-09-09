import { describe, it, expect } from "vitest";
import { amountInWords, formatMoney } from "./money";
import {
  computeCartTotals,
  markupPct,
  marginPct,
  priceFromTargetMargin,
  expiryLevel,
  expiryLabel,
  saleBalance,
} from "./calc";
import { resolveDatePreset, baghdadDayStart } from "./time";

describe("markup / margin", () => {
  it("cost 600 price 1500 -> markup 150.0%, margin 60.0%", () => {
    expect(markupPct(600, 1500)).toBeCloseTo(150.0, 5);
    expect(marginPct(600, 1500)).toBeCloseTo(60.0, 5);
  });

  it("50% target margin on cost 600 gives price 1200", () => {
    expect(priceFromTargetMargin(600, 50)).toBe(1200);
  });

  it("zero cost gives null (rendered as em dash, never Infinity)", () => {
    expect(markupPct(0, 1500)).toBeNull();
  });
});

describe("cart totals: proportional discount spread + tax on discounted taxable portion", () => {
  it("taxes only the discounted taxable portion when cart discount applied", () => {
    // one taxable line, one non-taxable line, 10% cart discount, 8% tax
    const lines = [
      { unitPrice: 1000, qty: 1, discountPct: 0, taxable: true },
      { unitPrice: 1000, qty: 1, discountPct: 0, taxable: false },
    ];
    const totals = computeCartTotals(lines, 10, 0.08);
    // afterLineDiscounts = 2000, cartDiscount = 200, subtotal = 1800
    expect(totals.afterLineDiscounts).toBe(2000);
    expect(totals.cartDiscount).toBe(200);
    expect(totals.subtotal).toBe(1800);
    // taxableBase = 1000 * (1800/2000) = 900, tax = round(900*0.08) = 72
    expect(totals.taxableBase).toBeCloseTo(900, 5);
    expect(totals.tax).toBe(72);
    expect(totals.total).toBe(1872);
  });
});

describe("on-account math", () => {
  it("$15.66 sale, $1.00 cash, rest on account records onAccount 14.66", () => {
    const total = 1566;
    const cashPaid = 100;
    const onAccount = total - cashPaid;
    expect(onAccount).toBe(1466);

    let balance = -17960; // -179.60
    balance -= onAccount;
    expect(balance).toBe(-19426); // -194.26

    // paying in full zeroes the balance
    balance += onAccount;
    expect(balance).toBe(-17960);
  });

  it("saleBalance: positive means on-account", () => {
    expect(saleBalance(1566, 100, 0)).toBe(1466);
    expect(saleBalance(1566, 1566, 0)).toBe(0);
  });
});

describe("expiry", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0); // 2026-01-01 12:00 UTC (Baghdad day = 2026-01-01)

  // Baghdad-local Y-M-D for an epoch that represents a Baghdad-midnight instant
  // (getUTC* getters would read the wrong calendar day, since that instant is 21:00 UTC).
  function baghdadDateStr(epochMs: number): string {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(epochMs));
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  it("5 days past -> 'Expired 5d ago'", () => {
    const dateStr = baghdadDateStr(baghdadDayStart(now) - 5 * 86400000);
    expect(expiryLabel(dateStr, now)).toBe("Expired 5d ago");
    expect(expiryLevel(dateStr, now, 6, 3)).toBe("expired");
  });

  it("40 days out -> urgent (within 3 months / 90 days)", () => {
    const dateStr = baghdadDateStr(baghdadDayStart(now) + 40 * 86400000);
    expect(expiryLevel(dateStr, now, 6, 3)).toBe("urgent");
  });

  it("150 days out -> warning (within 6 months / 180 days)", () => {
    const dateStr = baghdadDateStr(baghdadDayStart(now) + 150 * 86400000);
    expect(expiryLevel(dateStr, now, 6, 3)).toBe("warn");
  });

  it("400 days out -> ok", () => {
    const dateStr = baghdadDateStr(baghdadDayStart(now) + 400 * 86400000);
    expect(expiryLevel(dateStr, now, 6, 3)).toBe("ok");
  });

  it("no date -> none / untracked, never expired", () => {
    expect(expiryLevel(null, now, 6, 3)).toBe("none");
    expect(expiryLabel(null, now)).toBe("—");
  });
});

describe("markdown percentages off original price", () => {
  it("-30% on 14.50 -> 10.15", () => {
    const original = 1450;
    const newPrice = Math.round(original * 0.7);
    expect(newPrice).toBe(1015);
  });
});

describe("amount in words", () => {
  it("amountInWords(7127) = 'Seventy-one and 27/100'", () => {
    expect(amountInWords(7127)).toBe("Seventy-one and 27/100");
  });

  it("zero dollars", () => {
    expect(amountInWords(0)).toBe("Zero and 00/100");
  });

  it("large amount with thousands", () => {
    expect(amountInWords(123456700)).toBe(
      "One million two hundred thirty-four thousand five hundred sixty-seven and 00/100"
    );
  });
});

describe("formatMoney", () => {
  it("formats cents with thousands separators", () => {
    expect(formatMoney(123456, "$")).toBe("$1,234.56");
    expect(formatMoney(-500, "$")).toBe("-$5.00");
  });
});

describe("date presets", () => {
  it("today and yesterday resolve to adjacent Baghdad-day boundaries", () => {
    const now = Date.UTC(2026, 5, 15, 10, 0, 0);
    const today = resolveDatePreset("today", now);
    const yesterday = resolveDatePreset("yesterday", now);
    expect(today.from).toBe(yesterday.to);
    expect(today.to - today.from).toBe(86400000);
  });

  it("custom range is inclusive of both endpoints", () => {
    const now = Date.UTC(2026, 5, 15, 10, 0, 0);
    const custom = resolveDatePreset("custom", now, { from: "2026-06-01", to: "2026-06-03" });
    expect(custom.to - custom.from).toBe(3 * 86400000);
  });
});
