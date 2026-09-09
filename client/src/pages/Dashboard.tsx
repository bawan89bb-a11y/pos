import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/Shell";
import { trpc } from "../trpc";
import { useAuth } from "../lib/auth";
import { useFormatMoney } from "../lib/settings";
import { resolveDatePreset, formatDate } from "@thoth/shared";
import { Button, EmptyState } from "../components/ui";
import { Plus, PackagePlus, Receipt as ReceiptIcon, AlertTriangle } from "lucide-react";

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const positive = pct >= 0;
  return (
    <span className="text-[12px] font-medium tabular-nums" style={{ color: positive ? "var(--good)" : "var(--crit)" }}>
      {positive ? "+" : ""}
      {pct.toFixed(1)}% vs same time yesterday
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fmt = useFormatMoney();
  const now = Date.now();

  const today = useMemo(() => resolveDatePreset("today", now), []);
  const sameTimeYesterday = useMemo(() => {
    const y = resolveDatePreset("yesterday", now);
    const elapsed = now - today.from;
    return { from: y.from, to: y.from + elapsed };
  }, []);
  const thisMonth = useMemo(() => resolveDatePreset("thisMonth", now), []);
  const prevMonth = useMemo(() => resolveDatePreset("prevMonth", now), []);
  const prevMonthSameElapsed = useMemo(() => {
    const elapsedDays = Math.floor((now - thisMonth.from) / 86400000);
    return { from: prevMonth.from, to: prevMonth.from + (elapsedDays + 1) * 86400000 };
  }, []);

  const todayTiles = trpc.reports.summaryTiles.useQuery(today);
  const ydayTiles = trpc.reports.summaryTiles.useQuery(sameTimeYesterday);
  const monthTiles = trpc.reports.summaryTiles.useQuery(thisMonth);
  const prevMonthTiles = trpc.reports.summaryTiles.useQuery(prevMonthSameElapsed);
  const hourly = trpc.reports.netSalesByBucket.useQuery(today);
  const needsAttention = trpc.dashboard.needsAttention.useQuery({ now });
  const bestProducts = trpc.reports.topProducts.useQuery({ ...today, limit: 5 });
  const cashiers = trpc.reports.cashiersRanking.useQuery(today);

  const firstName = user?.name.split(" ")[0] ?? "";
  const maxHourly = Math.max(1, ...(hourly.data?.buckets.map((b) => b.sales) ?? [1]));
  const maxCashier = Math.max(1, ...(cashiers.data?.map((c) => c.total) ?? [1]));

  return (
    <AppShell title="Home">
      <div className="p-[18px] flex flex-col gap-5 max-w-[1200px]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[19px] font-semibold" style={{ color: "var(--ink)" }}>
              Good day, {firstName}
            </h1>
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              {formatDate(now)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate("/sell")}>
              <Plus size={15} /> New sale
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate("/catalog/products")}>
              <PackagePlus size={15} /> Add product
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate("/expenses")}>
              <ReceiptIcon size={15} /> Record expense
            </Button>
          </div>
        </div>

        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-3)" }}>
            Today
          </h2>
          <div className="grid grid-cols-4 gap-3">
            <Tile label="Sales" value={fmt(todayTiles.data?.netSales ?? 0)}>
              <Delta current={todayTiles.data?.netSales ?? 0} previous={ydayTiles.data?.netSales ?? 0} />
            </Tile>
            <Tile label="Expenses" value={fmt(todayTiles.data?.totalExpenses ?? 0)}>
              <Delta current={todayTiles.data?.totalExpenses ?? 0} previous={ydayTiles.data?.totalExpenses ?? 0} />
            </Tile>
            <Tile
              label="Profit"
              value={fmt(todayTiles.data?.netProfit ?? 0)}
              negative={(todayTiles.data?.netProfit ?? 0) < 0}
            >
              <Delta current={todayTiles.data?.netProfit ?? 0} previous={ydayTiles.data?.netProfit ?? 0} />
            </Tile>
            <Tile label="Items sold" value={String(todayTiles.data?.itemsSold ?? 0)}>
              <Delta current={todayTiles.data?.itemsSold ?? 0} previous={ydayTiles.data?.itemsSold ?? 0} />
            </Tile>
          </div>
        </section>

        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-3)" }}>
            This month
          </h2>
          <div className="grid grid-cols-4 gap-3">
            <Tile label="Sales" value={fmt(monthTiles.data?.netSales ?? 0)} />
            <Tile label="Expenses" value={fmt(monthTiles.data?.totalExpenses ?? 0)} />
            <Tile label="Profit" value={fmt(monthTiles.data?.netProfit ?? 0)} negative={(monthTiles.data?.netProfit ?? 0) < 0} />
            <Tile label="Items sold" value={String(monthTiles.data?.itemsSold ?? 0)} />
          </div>
        </section>

        <div className="grid grid-cols-[1.4fr_1fr] gap-4">
          <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Today by hour
            </h3>
            <div className="flex items-end gap-1 h-[140px]">
              {hourly.data?.buckets.map((b) => (
                <div key={b.ts} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${Math.max(2, (b.sales / maxHourly) * 100)}%`,
                      background: "var(--brand)",
                      opacity: b.sales > 0 ? 1 : 0.15,
                    }}
                    title={`${b.label}: ${fmt(b.sales)}`}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Cashiers today
            </h3>
            {!cashiers.data?.length ? (
              <EmptyState text="No sales rung up yet today." />
            ) : (
              <div className="flex flex-col gap-2">
                {cashiers.data.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-[11px] w-4 tabular-nums" style={{ color: "var(--ink-3)" }}>
                      {i + 1}
                    </span>
                    <span className="text-[12px] w-20 truncate" style={{ color: "var(--ink)" }}>
                      {c.name}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(c.total / maxCashier) * 100}%`, background: "var(--brand)" }}
                      />
                    </div>
                    <span className="text-[12px] tabular-nums font-medium" style={{ color: "var(--ink)" }}>
                      {fmt(c.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-4">
          <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
              <AlertTriangle size={15} /> Needs attention
            </h3>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--line)" }}>
              {needsAttention.data?.outOfStock.map((p) => (
                <AttentionRow key={p.id} text={`${p.name} is out of stock`} onClick={() => navigate("/catalog/products")} />
              ))}
              {needsAttention.data?.lowStock.map((p) => (
                <AttentionRow
                  key={p.id}
                  text={`${p.name} is low on stock (${p.stock} left)`}
                  onClick={() => navigate("/catalog/products")}
                />
              ))}
              {needsAttention.data?.expiringSoon.map((p) => (
                <AttentionRow key={p.id} text={`${p.name} is expiring soon`} onClick={() => navigate("/catalog/products")} />
              ))}
              {needsAttention.data?.suppliersToReorder.map((s) => (
                <AttentionRow key={s.id} text={`${s.count} products to reorder from ${s.name}`} onClick={() => navigate("/catalog/suppliers")} />
              ))}
              {needsAttention.data?.parkedSales.map((s) => (
                <AttentionRow key={s.id} text={`A parked sale is waiting (${s.itemCount} items)`} onClick={() => navigate("/sell")} />
              ))}
              {!!needsAttention.data?.expensesThisWeek && (
                <AttentionRow
                  text={`${fmt(needsAttention.data.expensesThisWeek)} in expenses this week`}
                  onClick={() => navigate("/expenses")}
                />
              )}
              {needsAttention.data &&
                !needsAttention.data.outOfStock.length &&
                !needsAttention.data.lowStock.length &&
                !needsAttention.data.expiringSoon.length &&
                !needsAttention.data.suppliersToReorder.length &&
                !needsAttention.data.parkedSales.length && <EmptyState text="Nothing needs your attention right now." />}
            </div>
          </section>

          <section className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--ink)" }}>
              Best products today
            </h3>
            {!bestProducts.data?.length ? (
              <EmptyState text="No sales yet today." />
            ) : (
              <div className="flex flex-col gap-2">
                {bestProducts.data.map((p, i) => (
                  <div key={p.sku} className="flex items-center justify-between text-[12px]">
                    <span style={{ color: "var(--ink)" }}>
                      {i + 1}. {p.name}
                    </span>
                    <span className="tabular-nums font-medium" style={{ color: "var(--ink)" }}>
                      {fmt(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Tile({
  label,
  value,
  negative,
  children,
}: {
  label: string;
  value: string;
  negative?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="text-[12px] mb-1" style={{ color: "var(--ink-3)" }}>
        {label}
      </div>
      <div className="text-[20px] font-semibold tabular-nums mb-1" style={{ color: negative ? "var(--crit)" : "var(--ink)" }}>
        {value}
      </div>
      {children}
    </div>
  );
}

function AttentionRow({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left py-2 text-[13px] hover:opacity-70" style={{ color: "var(--ink)" }}>
      {text}
    </button>
  );
}
