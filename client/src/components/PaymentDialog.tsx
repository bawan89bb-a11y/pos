import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSettings } from "../lib/settings";
import { formatMoney } from "@thoth/shared";
import type { Customer } from "@thoth/shared";

interface Tender {
  method: "cash" | "card" | "gift";
  amount: number;
  ref?: string;
}

export function PaymentDialog({
  total,
  customer,
  onClose,
  onComplete,
}: {
  total: number;
  customer: Customer | null;
  onClose: () => void;
  onComplete: (payments: Tender[], putOnAccount: boolean) => Promise<void>;
}) {
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? "$";
  const fmt = (c: number) => formatMoney(c, currency);

  const [method, setMethod] = useState<"cash" | "card" | "gift">("cash");
  const [amountStr, setAmountStr] = useState("");
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const tenderedSum = tenders.reduce((s, t) => s + t.amount, 0);
  const remaining = total - tenderedSum;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addTender(amount: number) {
    if (amount <= 0) return;
    if (method !== "cash" && amount > remaining) amount = remaining;
    setTenders((t) => [...t, { method, amount }]);
    setAmountStr("");
  }

  function removeTender(i: number) {
    setTenders((t) => t.filter((_, idx) => idx !== i));
  }

  async function finish(putOnAccount: boolean) {
    setSubmitting(true);
    try {
      await onComplete(tenders, putOnAccount);
    } finally {
      setSubmitting(false);
    }
  }

  const canCompleteFully = remaining <= 0;
  const canPutOnAccount = !!customer && remaining > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="w-[440px] rounded-2xl overflow-hidden" style={{ background: "var(--till-panel)", color: "var(--till-ink)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--till-line)" }}>
          <h2 className="font-semibold text-[15px]">Payment</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex gap-2 mb-4">
            {(["cash", "card", "gift"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium capitalize"
                style={{
                  background: method === m ? "var(--brand)" : "var(--till-input)",
                  color: method === m ? "#fff" : "var(--till-ink)",
                }}
              >
                {m === "gift" ? "Gift card" : m}
              </button>
            ))}
          </div>

          <div className="text-center mb-4">
            <div className="text-[12px]" style={{ color: "var(--till-muted)" }}>
              Remaining
            </div>
            <div className="text-[32px] font-semibold tabular-nums">{fmt(Math.max(0, remaining))}</div>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTender(Math.round(parseFloat(amountStr || "0") * 100));
              }}
              placeholder="0.00"
              className="flex-1 px-3 py-2.5 rounded-lg text-[16px] tabular-nums outline-none"
              style={{ background: "var(--till-input)", border: "1px solid var(--till-line)" }}
            />
            <button
              className="px-4 rounded-lg text-[13px] font-medium"
              style={{ background: "var(--brand)", color: "#fff" }}
              onClick={() => addTender(Math.round(parseFloat(amountStr || "0") * 100))}
            >
              Add
            </button>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              className="px-3 py-1.5 rounded-full text-[12px]"
              style={{ background: "var(--till-input)" }}
              onClick={() => addTender(remaining)}
            >
              Exact ({fmt(Math.max(0, remaining))})
            </button>
            {[5, 10, 20, 50].map((d) => (
              <button
                key={d}
                className="px-3 py-1.5 rounded-full text-[12px]"
                style={{ background: "var(--till-input)" }}
                onClick={() => addTender(d * 100)}
              >
                {currency}
                {d}
              </button>
            ))}
          </div>

          {tenders.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-4">
              {tenders.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-[13px] px-3 py-2 rounded-lg" style={{ background: "var(--till-input)" }}>
                  <span className="capitalize">{t.method}</span>
                  <span className="tabular-nums">{fmt(t.amount)}</span>
                  <button onClick={() => removeTender(i)} style={{ color: "var(--till-muted)" }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              disabled={!canCompleteFully || submitting}
              onClick={() => finish(false)}
              className="w-full py-3 rounded-lg font-semibold text-[14px] disabled:opacity-40"
              style={{ background: "var(--brand)", color: "#fff" }}
            >
              Complete sale {remaining < 0 ? `· Change ${fmt(-remaining)}` : ""}
            </button>
            {canPutOnAccount && (
              <button
                disabled={submitting}
                onClick={() => finish(true)}
                className="w-full py-2.5 rounded-lg font-medium text-[13px]"
                style={{ background: "var(--till-input)", color: "var(--till-ink)" }}
              >
                Put {fmt(remaining)} on account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
