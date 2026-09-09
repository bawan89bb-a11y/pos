import { useEffect, useState } from "react";
import { trpc } from "../../trpc";
import { useAuth } from "../../lib/auth";
import { can, expiryLevel, expiryLabel } from "@thoth/shared";
import { Button, Field, inputStyle, Pill, EmptyState } from "../../components/ui";

const WARN_OPTIONS = [3, 6, 9, 12];
const URGENT_OPTIONS = [1, 2, 3, 6];

export default function StockExpirySection() {
  const { user } = useAuth();
  const canEdit = can(user?.perms, "settings", "edit");
  const settingsQuery = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation();
  const productsQuery = trpc.products.list.useQuery({ status: "active" });
  const updateProduct = trpc.products.update.useMutation();
  const utils = trpc.useUtils();

  const [warnMonths, setWarnMonths] = useState<number | null>(null);
  const [urgentMonths, setUrgentMonths] = useState<number | null>(null);
  useEffect(() => {
    if (settingsQuery.data) {
      setWarnMonths((w) => w ?? settingsQuery.data!.expiryWarnMonths);
      setUrgentMonths((u) => u ?? settingsQuery.data!.expiryUrgentMonths);
    }
  }, [settingsQuery.data]);

  const now = Date.now();
  const needsAttention = (productsQuery.data ?? []).filter((p) => {
    const level = expiryLevel(p.expiry, now, p.expiryWarnMonths ?? warnMonths ?? 6, urgentMonths ?? 3);
    return level === "expired" || level === "urgent" || level === "warn";
  });

  if (warnMonths === null || urgentMonths === null) return null;

  return (
    <div className="p-[18px] max-w-[820px] flex flex-col gap-5">
      <h2 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
        Stock & expiry
      </h2>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Field label="First warning">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={warnMonths} onChange={(e) => setWarnMonths(Number(e.target.value))}>
            {WARN_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} months
              </option>
            ))}
          </select>
        </Field>
        <Field label="Urgent">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={urgentMonths} onChange={(e) => setUrgentMonths(Number(e.target.value))}>
            {URGENT_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} months
              </option>
            ))}
          </select>
        </Field>
      </div>
      {canEdit && (
        <div>
          <Button onClick={() => updateMutation.mutate({ expiryWarnMonths: warnMonths, expiryUrgentMonths: urgentMonths })}>Save</Button>
        </div>
      )}

      <h3 className="text-[13px] font-semibold mt-2" style={{ color: "var(--ink)" }}>
        Needs attention now
      </h3>
      <div className="rounded-[10px] overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left uppercase text-[11px]" style={{ color: "var(--ink-3)" }}>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {needsAttention.map((p) => {
              const level = expiryLevel(p.expiry, now, p.expiryWarnMonths ?? warnMonths, urgentMonths);
              return (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">
                    <Pill tone={level === "expired" ? "crit" : level === "urgent" ? "warn" : "neutral"}>{expiryLabel(p.expiry, now)}</Pill>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      style={{ color: "var(--brand)" }}
                      onClick={async () => {
                        const pct = Number(prompt("Mark down by %", "20") ?? 0);
                        if (!pct) return;
                        await updateProduct.mutateAsync({ id: p.id, patch: { price: Math.round(p.price * (1 - pct / 100)) } });
                        utils.products.list.invalidate();
                      }}
                    >
                      Mark down
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!needsAttention.length && <EmptyState text="Nothing needs attention right now." />}
      </div>
    </div>
  );
}
