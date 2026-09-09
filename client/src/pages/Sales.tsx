import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../components/Shell";
import { trpc } from "../trpc";
import { useAuth } from "../lib/auth";
import { useFormatMoney } from "../lib/settings";
import { resolveDatePreset, formatDateTime, can, type DatePresetId } from "@thoth/shared";
import type { Sale } from "@thoth/shared";
import { Button, Pill, EmptyState, Modal, Field, inputStyle } from "../components/ui";
import { ChevronRight, ChevronDown, Undo2 } from "lucide-react";
import { DocumentDialog } from "../components/Document";

const PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "prevMonth", label: "Previous month" },
  { id: "allTime", label: "All time" },
];

function saleStatusLabel(sale: Sale): { label: string; tone: "good" | "warn" | "crit" | "neutral" } {
  if (sale.status === "void") return { label: "Voided", tone: "neutral" };
  if (sale.status === "refunded") return { label: "Refunded", tone: "crit" };
  const refunded = sale.refunds.reduce((s, r) => s + r.amount, 0);
  if (refunded > 0) return { label: "Partial refund", tone: "warn" };
  if (sale.onAccount > 0) return { label: "On-account", tone: "warn" };
  return { label: "Closed", tone: "good" };
}

export default function Sales() {
  const { user } = useAuth();
  const fmt = useFormatMoney();
  const [searchParams] = useSearchParams();
  const [preset, setPreset] = useState<DatePresetId>(searchParams.get("customer") ? "allTime" : "last30");
  const [search, setSearch] = useState("");
  const [stagedSearch, setStagedSearch] = useState("");
  const [customerId, setCustomerId] = useState(searchParams.get("customer") ?? "");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docSaleId, setDocSaleId] = useState<string | null>(null);
  const [refundSale, setRefundSale] = useState<Sale | null>(null);
  const [voidSale, setVoidSale] = useState<Sale | null>(null);

  const range = useMemo(() => resolveDatePreset(preset), [preset]);
  const salesQuery = trpc.sales.list.useQuery({ from: range.from, to: range.to, search: search || undefined, customerId: customerId || undefined });
  const customersQuery = trpc.customers.list.useQuery({});
  const filteredCustomerName = customersQuery.data?.find((c) => c.id === customerId)?.name;
  const utils = trpc.useUtils();

  function exportCsv() {
    const rows = salesQuery.data ?? [];
    const header = ["Receipt", "Date", "Customer", "Total", "Status"];
    const lines = rows.map((s) => [s.no, formatDateTime(s.ts), s.customerId ?? "", (s.total / 100).toFixed(2), saleStatusLabel(s).label]);
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sales.csv";
    a.click();
  }

  return (
    <AppShell title="Sales">
      <div className="p-[18px] flex flex-col gap-4">
        <div
          className="rounded-[10px] p-4 grid grid-cols-4 gap-3 items-end"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          <Field label="Date range">
            <select
              className="w-full px-3 py-2 text-[14px] border outline-none"
              style={inputStyle}
              value={preset}
              onChange={(e) => setPreset(e.target.value as DatePresetId)}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Customer">
            <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">All customers</option>
              {customersQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Receipt, note or product">
            <input
              className="w-full px-3 py-2 text-[14px] border outline-none"
              style={inputStyle}
              value={stagedSearch}
              onChange={(e) => setStagedSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(stagedSearch)}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => setSearch(stagedSearch)}>Search</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setStagedSearch("");
                setSearch("");
                setCustomerId("");
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="flex justify-between items-center text-[13px]" style={{ color: "var(--ink-3)" }}>
          <span>
            Displaying {salesQuery.data?.length ?? 0} sales
            {filteredCustomerName ? ` matching customer "${filteredCustomerName}"` : ""}
          </span>
          {can(user?.perms, "sales", "export") && (
            <button className="font-medium" style={{ color: "var(--brand)" }} onClick={exportCsv}>
              Export list
            </button>
          )}
        </div>

        <div className="rounded-[10px] overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left uppercase text-[11px]" style={{ color: "var(--ink-3)" }}>
                <th className="w-8" />
                <th className="px-3 py-2.5">Receipt</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Note</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {salesQuery.data?.map((sale) => (
                <SaleRow
                  key={sale.id}
                  sale={sale}
                  expanded={expandedId === sale.id}
                  onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                  fmt={fmt}
                  onView={() => setDocSaleId(sale.id)}
                  onRefund={() => setRefundSale(sale)}
                  onVoid={() => setVoidSale(sale)}
                />
              ))}
            </tbody>
          </table>
          {salesQuery.data && salesQuery.data.length === 0 && (
            <EmptyState text="No sales match these filters yet." />
          )}
        </div>
      </div>

      {docSaleId && <DocumentDialog saleId={docSaleId} onClose={() => setDocSaleId(null)} />}
      {refundSale && (
        <RefundDialog
          sale={refundSale}
          onClose={() => setRefundSale(null)}
          onDone={() => {
            setRefundSale(null);
            utils.sales.list.invalidate();
          }}
        />
      )}
      {voidSale && (
        <VoidDialog
          sale={voidSale}
          onClose={() => setVoidSale(null)}
          onDone={() => {
            setVoidSale(null);
            utils.sales.list.invalidate();
          }}
        />
      )}
    </AppShell>
  );
}

function SaleRow({
  sale,
  expanded,
  onToggle,
  fmt,
  onView,
  onRefund,
  onVoid,
}: {
  sale: Sale;
  expanded: boolean;
  onToggle: () => void;
  fmt: (c: number) => string;
  onView: () => void;
  onRefund: () => void;
  onVoid: () => void;
}) {
  const { user } = useAuth();
  const status = saleStatusLabel(sale);
  const customerQuery = trpc.customers.get.useQuery(sale.customerId ?? "", { enabled: !!sale.customerId && expanded });
  const usersQuery = trpc.users.names.useQuery();
  const cashier = usersQuery.data?.find((u) => u.id === sale.userId);
  const refundedTotal = sale.refunds.reduce((s, r) => s + r.amount, 0);
  const payOnAccount = trpc.sales.payOnAccountBalance.useMutation();
  const utils = trpc.useUtils();

  return (
    <>
      <tr className="border-t hover:opacity-95 cursor-pointer" style={{ borderColor: "var(--line)" }} onClick={onToggle}>
        <td className="px-3">{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
        <td className="px-3 py-2.5">
          <div className="font-medium" style={{ color: "var(--ink)" }}>
            {sale.no}
          </div>
          <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            {formatDateTime(sale.ts)}
          </div>
        </td>
        <td className="px-3 py-2.5">{customerQuery.data?.name ?? "—"}</td>
        <td className="px-3 py-2.5 truncate max-w-[160px]" style={{ color: "var(--ink-3)" }}>
          {sale.note}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmt(sale.total)}</td>
        <td className="px-3 py-2.5">
          <Pill tone={status.tone}>{status.label}</Pill>
        </td>
        <td className="px-3 py-2.5">
          {sale.status !== "void" && (
            <button
              title="Refund"
              onClick={(e) => {
                e.stopPropagation();
                onRefund();
              }}
              style={{ color: "var(--ink-3)" }}
            >
              <Undo2 size={15} />
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
          <td colSpan={7} className="p-0">
            <div className="flex">
              <div className="flex-1 p-4 text-[13px]">
                {sale.lines.map((l, i) => (
                  <div key={i} className="flex justify-between py-1">
                    <span>
                      {l.qty} × {l.name} <span style={{ color: "var(--ink-3)" }}>({l.sku})</span>
                      {l.discountPct > 0 && <span style={{ color: "var(--ink-3)" }}> −{l.discountPct}%</span>}
                    </span>
                    <span className="tabular-nums">{fmt(Math.round(l.unitPrice * l.qty * (1 - l.discountPct / 100)))}</span>
                  </div>
                ))}
                <div className="h-px my-2" style={{ background: "var(--line)" }} />
                <div className="flex justify-between py-0.5">
                  <span style={{ color: "var(--ink-3)" }}>Subtotal</span>
                  <span className="tabular-nums">{fmt(sale.subtotal)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span style={{ color: "var(--ink-3)" }}>Discount</span>
                  <span className="tabular-nums">{fmt(sale.discount)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span style={{ color: "var(--ink-3)" }}>Total tax</span>
                  <span className="tabular-nums">{fmt(sale.tax)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold border-t mt-1" style={{ borderColor: "var(--line)" }}>
                  <span>Sale total</span>
                  <span className="tabular-nums">{fmt(sale.total)}</span>
                </div>
                {sale.payments.map((p, i) => (
                  <div key={i} className="flex justify-between py-0.5" style={{ color: "var(--ink-3)" }}>
                    <span className="capitalize">
                      {p.method} {p.ref}
                    </span>
                    <span className="tabular-nums">{fmt(p.amount)}</span>
                  </div>
                ))}
                {sale.change > 0 && (
                  <div className="flex justify-between py-0.5">
                    <span style={{ color: "var(--ink-3)" }}>Change</span>
                    <span className="tabular-nums">{fmt(sale.change)}</span>
                  </div>
                )}
                {refundedTotal > 0 && (
                  <div className="flex justify-between py-0.5">
                    <span style={{ color: "var(--ink-3)" }}>Refunded</span>
                    <span className="tabular-nums">{fmt(refundedTotal)}</span>
                  </div>
                )}
                {sale.onAccount > 0 && (
                  <div className="flex justify-between py-0.5 font-medium" style={{ color: "var(--warn)" }}>
                    <span>Balance</span>
                    <span className="tabular-nums">{fmt(sale.onAccount)}</span>
                  </div>
                )}
              </div>
              <div className="w-[230px] p-4 flex flex-col gap-2 text-[13px] border-l" style={{ borderColor: "var(--line)" }}>
                <button className="text-left" style={{ color: "var(--brand)" }} onClick={onView}>
                  View invoice
                </button>
                <button className="text-left" style={{ color: "var(--brand)" }} onClick={onView}>
                  Print receipt
                </button>
                {sale.onAccount > 0 && sale.customerId && can(user?.perms, "sales", "edit") && (
                  <button
                    className="text-left"
                    style={{ color: "var(--brand)" }}
                    onClick={async () => {
                      await payOnAccount.mutateAsync({ saleId: sale.id, amount: sale.onAccount });
                      utils.sales.list.invalidate();
                    }}
                  >
                    Pay account balance
                  </button>
                )}
                {sale.status !== "void" && can(user?.perms, "sales", "edit") && (
                  <button className="text-left" style={{ color: "var(--brand)" }} onClick={onRefund}>
                    Refund
                  </button>
                )}
                {sale.status !== "void" && can(user?.perms, "sales", "delete") && (
                  <button className="text-left" style={{ color: "var(--crit)" }} onClick={onVoid}>
                    Void
                  </button>
                )}
                <div className="mt-2 pt-2 border-t text-[11px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
                  Sold by {cashier?.name}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RefundDialog({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }) {
  const fmt = useFormatMoney();
  const alreadyRefunded = sale.refunds.reduce((s, r) => s + r.amount, 0);
  const remaining = sale.total - alreadyRefunded;
  const [amountStr, setAmountStr] = useState((remaining / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const refundMutation = trpc.sales.refund.useMutation();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Refund ${sale.no}`}
      footer={
        <>
          <span />
          <Button
            variant="destructive"
            onClick={async () => {
              await refundMutation.mutateAsync({
                saleId: sale.id,
                amount: Math.round(parseFloat(amountStr || "0") * 100),
                reason,
                restock,
                restockLines: restock ? sale.lines.map((l) => ({ productId: l.productId, qty: l.qty })) : undefined,
              });
              onDone();
            }}
          >
            Issue refund
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={`Amount (up to ${fmt(remaining)})`}>
          <input className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums" style={inputStyle} value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        </Field>
        <Field label="Reason">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          Restock these items
        </label>
      </div>
    </Modal>
  );
}

function VoidDialog({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const voidMutation = trpc.sales.void.useMutation();
  return (
    <Modal
      open
      onClose={onClose}
      title={`Void ${sale.no}`}
      footer={
        <>
          <span />
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={async () => {
              await voidMutation.mutateAsync({ saleId: sale.id, reason });
              onDone();
            }}
          >
            Void sale
          </Button>
        </>
      }
    >
      <p className="text-[13px] mb-3" style={{ color: "var(--ink-2)" }}>
        This returns every line to stock, reverses any account debt, and removes this sale from all reports. It stays visible in this list.
      </p>
      <Field label="Reason">
        <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
