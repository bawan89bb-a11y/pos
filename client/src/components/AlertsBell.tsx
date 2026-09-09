import { useState } from "react";
import { Bell } from "lucide-react";
import { trpc } from "../trpc";
import { Modal, Pill, Button, EmptyState } from "./ui";
import { useFormatMoney } from "../lib/settings";
import { useToast } from "../lib/toast";

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [markdownTarget, setMarkdownTarget] = useState<any | null>(null);
  const now = Date.now();
  const { data } = trpc.alerts.expiry.useQuery({ now }, { refetchInterval: 5 * 60_000 });
  const badgeCount = (data?.expiredCount ?? 0) + (data?.urgentCount ?? 0);
  const fmt = useFormatMoney();

  return (
    <>
      <button
        className="relative p-1.5 rounded-full hover:opacity-80"
        style={{ color: "var(--ink-2)" }}
        onClick={() => setOpen(true)}
        aria-label="Expiry alerts"
      >
        <Bell size={19} />
        {badgeCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--crit)", color: "#fff" }}
          >
            {badgeCount}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Expiry alerts" width={640}>
        <div className="flex gap-2 mb-4 flex-wrap">
          <Pill tone="crit">{data?.expiredCount ?? 0} expired</Pill>
          <Pill tone="warn">{data?.urgentCount ?? 0} within urgent window</Pill>
          <Pill tone="neutral">{data?.warnCount ?? 0} within warning window</Pill>
        </div>
        {!data?.alerts.length ? (
          <EmptyState text="Nothing is expiring soon — products with tracked expiry dates will show up here." />
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--line)" }}>
            {data.alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                    {a.name}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                    {a.sku} · {a.category}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Pill tone={a.level === "expired" ? "crit" : a.level === "urgent" ? "warn" : "neutral"}>
                    {a.expiry}
                  </Pill>
                  <div className="text-[11px] mt-1 tabular-nums" style={{ color: "var(--ink-3)" }}>
                    {a.stock} on hand · {fmt(a.valueAtRisk)} at risk
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setMarkdownTarget(a)}>
                  Mark down
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {markdownTarget && (
        <MarkdownDialog product={markdownTarget} onClose={() => setMarkdownTarget(null)} />
      )}
    </>
  );
}

function MarkdownDialog({ product, onClose }: { product: any; onClose: () => void }) {
  const originalPrice = product.price;
  const [price, setPrice] = useState(originalPrice);
  const fmt = useFormatMoney();
  const { show } = useToast();
  const utils = trpc.useUtils();
  const updateMutation = trpc.products.update.useMutation();

  const productQuery = trpc.products.get.useQuery(product.id);
  const cost = productQuery.data?.cost ?? 0;
  const margin = price > 0 ? ((price - cost) / price) * 100 : null;
  const profitPerUnit = price - cost;
  const belowCost = price < cost;

  async function apply() {
    await updateMutation.mutateAsync({ id: product.id, patch: { price } });
    utils.alerts.expiry.invalidate();
    utils.products.list.invalidate();
    show(`${product.name} marked down to ${fmt(price)}`, async () => {
      await updateMutation.mutateAsync({ id: product.id, patch: { price: originalPrice } });
      utils.alerts.expiry.invalidate();
      utils.products.list.invalidate();
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Mark down · ${product.name}`}
      footer={
        <>
          <span />
          <Button onClick={apply}>Apply markdown</Button>
        </>
      }
    >
      <p className="text-[13px] mb-3" style={{ color: "var(--ink-2)" }}>
        Currently {fmt(originalPrice)}, {product.stock} on hand, expires {product.expiry}.
      </p>
      <div className="flex gap-2 mb-3">
        {[10, 20, 30, 50].map((pct) => (
          <Button key={pct} size="sm" variant="secondary" onClick={() => setPrice(Math.round(originalPrice * (1 - pct / 100)))}>
            −{pct}%
          </Button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5 mb-4">
        <span className="text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
          New retail price (cents)
        </span>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums"
          style={{ background: "var(--surface)", borderColor: "var(--line)", borderRadius: "var(--radius-control)", color: "var(--ink)" }}
        />
      </label>
      <div className="rounded-lg p-3 text-[13px]" style={{ background: "var(--surface-2)" }}>
        <div className="flex justify-between mb-1">
          <span style={{ color: "var(--ink-2)" }}>New price</span>
          <span className="tabular-nums font-medium">{fmt(price)}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span style={{ color: "var(--ink-2)" }}>Margin</span>
          <span className="tabular-nums font-medium" style={{ color: belowCost ? "var(--crit)" : "var(--ink)" }}>
            {margin === null ? "—" : `${margin.toFixed(1)}%`}
          </span>
        </div>
        <div className="flex justify-between mb-1">
          <span style={{ color: "var(--ink-2)" }}>Profit per unit</span>
          <span className="tabular-nums font-medium" style={{ color: belowCost ? "var(--crit)" : "var(--ink)" }}>
            {fmt(profitPerUnit)}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "var(--ink-2)" }}>Value of stock at new price</span>
          <span className="tabular-nums font-medium">{fmt(price * product.stock)}</span>
        </div>
        {belowCost && (
          <p className="mt-2 text-[12px]" style={{ color: "var(--crit)" }}>
            This is below cost. Clearing expiring stock below cost is sometimes the right call.
          </p>
        )}
      </div>
    </Modal>
  );
}
