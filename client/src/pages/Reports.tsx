import { useMemo, useState } from "react";
import { AppShell } from "../components/Shell";
import { trpc } from "../trpc";
import { useFormatMoney } from "../lib/settings";
import { resolveDatePreset, toCsv, type DatePresetId } from "@thoth/shared";
import { Button, EmptyState, Field, inputStyle } from "../components/ui";

const PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "prevMonth", label: "Previous month" },
  { id: "allTime", label: "All time" },
];

export default function Reports() {
  const fmt = useFormatMoney();
  const [preset, setPreset] = useState<DatePresetId>("last30");
  const [tableView, setTableView] = useState(false);
  const range = useMemo(() => resolveDatePreset(preset), [preset]);

  const tiles = trpc.reports.summaryTiles.useQuery(range);
  const buckets = trpc.reports.netSalesByBucket.useQuery(range);
  const mix = trpc.reports.paymentMix.useQuery(range);
  const expensesByType = trpc.reports.expensesByType.useQuery(range);
  const topProducts = trpc.reports.topProducts.useQuery({ ...range, limit: 10 });

  const totalTendered = mix.data?.reduce((s, m) => s + m.total, 0) ?? 0;
  const maxBucket = Math.max(1, ...(buckets.data?.buckets.map((b) => b.sales) ?? [1]));
  const totalExpenseTypes = expensesByType.data?.reduce((s, t) => s + t.total, 0) ?? 0;

  function exportCsv() {
    const rows = (buckets.data?.buckets ?? []).map((b) => [b.label, (b.sales / 100).toFixed(2), String(b.count)]);
    const csv = toCsv(["Bucket", "Net sales", "Sale count"], rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "report.csv";
    a.click();
  }

  return (
    <AppShell title="Reports" actions={<Button size="sm" variant="secondary" onClick={() => window.print()}>Print</Button>}>
      <div className="p-[18px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className="px-3 py-1.5 rounded-full text-[13px] font-medium"
                style={{ background: preset === p.id ? "var(--brand)" : "var(--surface-3)", color: preset === p.id ? "#fff" : "var(--ink-2)" }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="text-[13px] font-medium" style={{ color: "var(--brand)" }} onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
          Showing {range.label}
        </p>

        <div className="grid grid-cols-4 gap-3">
          <Tile label="Net sales" value={fmt(tiles.data?.netSales ?? 0)} />
          <Tile label="Average sale" value={fmt(tiles.data?.avgSale ?? 0)} />
          <Tile label="Items sold" value={String(tiles.data?.itemsSold ?? 0)} />
          <Tile label="Gross profit" value={fmt(tiles.data?.grossProfit ?? 0)} />
          <Tile label="Total expenses" value={fmt(tiles.data?.totalExpenses ?? 0)} />
          <Tile label="Net profit" value={fmt(tiles.data?.netProfit ?? 0)} negative={(tiles.data?.netProfit ?? 0) < 0} />
          <Tile label="Tax collected" value={fmt(tiles.data?.taxCollected ?? 0)} />
        </div>

        <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
              Net sales by {buckets.data?.granularity ?? "day"}
            </h3>
            <button className="text-[12px] font-medium" style={{ color: "var(--brand)" }} onClick={() => setTableView((v) => !v)}>
              {tableView ? "Chart view" : "Table view"}
            </button>
          </div>
          {tableView ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase" style={{ color: "var(--ink-3)" }}>
                  <th className="py-1">Bucket</th>
                  <th className="py-1 text-right">Sales</th>
                  <th className="py-1 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {buckets.data?.buckets.map((b) => (
                  <tr key={b.ts} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="py-1">{b.label}</td>
                    <td className="py-1 text-right tabular-nums">{fmt(b.sales)}</td>
                    <td className="py-1 text-right tabular-nums">{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-end gap-1 h-[160px]">
              {buckets.data?.buckets.map((b) => (
                <div key={b.ts} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${Math.max(2, (b.sales / maxBucket) * 100)}%`, background: "var(--brand)", opacity: b.sales > 0 ? 1 : 0.15 }}
                    title={`${b.label}: ${fmt(b.sales)}`}
                  />
                  <span className="text-[9px] mt-1 truncate w-full text-center" style={{ color: "var(--ink-3)" }}>
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-4">
          <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Payment mix
            </h3>
            {!mix.data?.length ? (
              <EmptyState text="No payments in this range." />
            ) : (
              <div className="flex flex-col gap-2">
                {mix.data.map((m) => (
                  <div key={m.method} className="flex items-center gap-2">
                    <span className="capitalize w-16 text-[12px]" style={{ color: "var(--ink)" }}>
                      {m.method}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
                      <div className="h-full" style={{ width: `${(m.total / totalTendered) * 100}%`, background: "var(--series-1)" }} />
                    </div>
                    <span className="tabular-nums text-[12px] font-medium">{fmt(m.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Top products by revenue
            </h3>
            {!topProducts.data?.length ? (
              <EmptyState text="No sales in this range." />
            ) : (
              <div className="flex flex-col gap-2">
                {topProducts.data.map((p, i) => (
                  <div key={p.sku} className="flex justify-between text-[12px]">
                    <span style={{ color: "var(--ink)" }}>
                      {i + 1}. {p.name}
                    </span>
                    <span className="tabular-nums font-medium">{fmt(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
            Expenses by type
          </h3>
          <div className="flex flex-col gap-2 mb-3">
            {expensesByType.data?.filter((t) => t.total > 0).map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="w-24 text-[12px] truncate" style={{ color: "var(--ink)" }}>
                  {t.name}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
                  <div className="h-full" style={{ width: `${(t.total / totalExpenseTypes) * 100}%`, background: t.color }} />
                </div>
                <span className="tabular-nums text-[12px] w-24 text-right">{fmt(t.total)}</span>
                <span className="tabular-nums text-[11px] w-12 text-right" style={{ color: "var(--ink-3)" }}>
                  {totalExpenseTypes ? `${((t.total / totalExpenseTypes) * 100).toFixed(0)}%` : "0%"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
            Profit summary
          </h3>
          <div className="flex flex-col gap-1.5 text-[13px] max-w-md">
            <Row label="Net sales" value={fmt(tiles.data?.netSales ?? 0)} />
            <Row label="Cost of goods" value={`−${fmt((tiles.data?.netSales ?? 0) - (tiles.data?.grossProfit ?? 0))}`} />
            <Row label="Gross profit" value={fmt(tiles.data?.grossProfit ?? 0)} bold />
            {expensesByType.data?.filter((t) => t.total > 0).map((t) => (
              <Row key={t.id} label={t.name} value={`−${fmt(t.total)}`} />
            ))}
            <Row label="Total expenses" value={`−${fmt(tiles.data?.totalExpenses ?? 0)}`} />
            <Row label="Net profit" value={fmt(tiles.data?.netProfit ?? 0)} bold negative={(tiles.data?.netProfit ?? 0) < 0} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Tile({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="text-[12px] mb-1" style={{ color: "var(--ink-3)" }}>
        {label}
      </div>
      <div className="text-[17px] font-semibold tabular-nums" style={{ color: negative ? "var(--crit)" : "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold border-t pt-1.5 mt-1" : ""}`} style={{ borderColor: "var(--line)" }}>
      <span style={{ color: bold ? "var(--ink)" : "var(--ink-2)" }}>{label}</span>
      <span className="tabular-nums" style={{ color: negative ? "var(--crit)" : "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}
