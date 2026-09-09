import { useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "../trpc";
import { useSettings } from "../lib/settings";
import { formatMoney, formatDateTime, amountInWords } from "@thoth/shared";
import { X, Printer, Download } from "lucide-react";
import type { Sale } from "@thoth/shared";

export function DocumentDialog({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const { data: settings } = useSettings();
  const saleQuery = trpc.sales.get.useQuery(saleId);
  const [format, setFormat] = useState<"receipt" | "a4">(settings?.docFormat ?? "receipt");
  const customerQuery = trpc.customers.get.useQuery(saleQuery.data?.customerId ?? "", {
    enabled: !!saleQuery.data?.customerId,
  });
  const cashierQuery = trpc.users.names.useQuery();
  const cashierName = cashierQuery.data?.find((u) => u.id === saleQuery.data?.userId)?.name ?? "";

  if (!saleQuery.data || !settings) return null;

  function saveAsHtml() {
    const el = document.getElementById("doc-print-area");
    if (!el) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${saleQuery.data!.no}</title><style>${DOC_STYLES}</style></head><body>${el.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${saleQuery.data!.no}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center print:static print:bg-white" style={{ background: "rgba(0,0,0,0.5)" }}>
      <style>{DOC_STYLES}</style>
      <div className="doc-shell bg-white rounded-xl flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:overflow-visible print:rounded-none" style={{ width: format === "a4" ? 820 : 380 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b no-print">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "#ddd" }}>
            <button
              className="px-3 py-1.5 text-[12px]"
              style={{ background: format === "receipt" ? "#111" : "#fff", color: format === "receipt" ? "#fff" : "#111" }}
              onClick={() => setFormat("receipt")}
            >
              Receipt
            </button>
            <button
              className="px-3 py-1.5 text-[12px]"
              style={{ background: format === "a4" ? "#111" : "#fff", color: format === "a4" ? "#fff" : "#111" }}
              onClick={() => setFormat("a4")}
            >
              A4 Invoice
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={saveAsHtml} className="p-2 rounded-lg hover:bg-gray-100" title="Save as HTML">
              <Download size={16} />
            </button>
            <button onClick={() => window.print()} className="p-2 rounded-lg hover:bg-gray-100" title="Print">
              <Printer size={16} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto print:overflow-visible print:max-h-none" id="doc-print-area">
          {format === "receipt" ? (
            <Receipt80mm sale={saleQuery.data} settings={settings} customerName={customerQuery.data?.name} cashierName={cashierName} />
          ) : (
            <InvoiceA4 sale={saleQuery.data} settings={settings} customerName={customerQuery.data?.name} customerPhone={customerQuery.data?.phone} cashierName={cashierName} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Receipt80mm({
  sale,
  settings,
  customerName,
  cashierName,
}: {
  sale: Sale;
  settings: any;
  customerName?: string;
  cashierName: string;
}) {
  const fmt = (c: number) => formatMoney(c, settings.currency);
  const refundedTotal = sale.refunds.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="receipt-80mm px-4 py-5 text-[12px] font-mono text-black bg-white">
      {settings.showLogoOnInvoice && settings.logo && <img src={settings.logo} className="w-12 mb-2" />}
      <div className="text-center mb-2">
        <div className="font-bold text-[13px]">{settings.store}</div>
        <div>{settings.addr}</div>
        <div>{settings.phone}</div>
        <div>{settings.email}</div>
      </div>
      <div className="text-center font-bold mb-2">{settings.invoiceTitle}</div>
      <div className="flex justify-between">
        <span>{sale.no}</span>
        <span>{formatDateTime(sale.ts)}</span>
      </div>
      {customerName && <div>Customer: {customerName}</div>}
      <div>Served by: {cashierName}</div>
      {sale.note && <div>Note: {sale.note}</div>}
      <div className="border-t border-dashed border-black my-2" />
      {sale.lines.map((l, i) => (
        <div key={i} className="flex justify-between">
          <span>
            {l.qty} × {l.name}
            {l.discountPct > 0 ? ` (−${l.discountPct}%)` : ""}
          </span>
          <span className="tabular-nums">{fmt(Math.round(l.unitPrice * l.qty * (1 - l.discountPct / 100)))}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span className="tabular-nums">{fmt(sale.subtotal)}</span>
      </div>
      {sale.discount > 0 && (
        <div className="flex justify-between">
          <span>Discount</span>
          <span className="tabular-nums">−{fmt(sale.discount)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>Tax</span>
        <span className="tabular-nums">{fmt(sale.tax)}</span>
      </div>
      <div className="flex justify-between font-bold text-[13px]">
        <span>TOTAL</span>
        <span className="tabular-nums">{fmt(sale.total)}</span>
      </div>
      <div className="border-t border-dashed border-black my-2" />
      {sale.payments.map((p, i) => (
        <div key={i} className="flex justify-between">
          <span className="capitalize">
            {p.method} {p.ref}
          </span>
          <span className="tabular-nums">{fmt(p.amount)}</span>
        </div>
      ))}
      {sale.change > 0 && (
        <div className="flex justify-between">
          <span>Change</span>
          <span className="tabular-nums">{fmt(sale.change)}</span>
        </div>
      )}
      {refundedTotal > 0 && (
        <div className="flex justify-between">
          <span>Refunded</span>
          <span className="tabular-nums">{fmt(refundedTotal)}</span>
        </div>
      )}
      <div className="border-t border-dashed border-black my-2" />
      <div className="text-center">{settings.receiptFooter}</div>
    </div>
  );
}

function InvoiceA4({
  sale,
  settings,
  customerName,
  customerPhone,
  cashierName,
}: {
  sale: Sale;
  settings: any;
  customerName?: string;
  customerPhone?: string;
  cashierName: string;
}) {
  const fmt = (c: number) => formatMoney(c, settings.currency);
  const refundedTotal = sale.refunds.reduce((s, r) => s + r.amount, 0);
  const paidTotal = sale.payments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = sale.onAccount;
  const status = sale.status === "void" ? "VOID" : refundedTotal > 0 ? "REFUNDED" : balanceDue > 0 ? "BALANCE DUE" : "PAID";
  const stampColor = status === "PAID" ? "#0ca30c" : status === "BALANCE DUE" ? "#fab219" : "#d03b3b";

  return (
    <div className="invoice-a4 bg-white text-black px-[15mm] py-[16mm] relative" style={{ width: "210mm", minHeight: "297mm" }}>
      <div className="flex justify-between items-start bizline">
        <div className="flex gap-3 items-start">
          {settings.showLogoOnInvoice && settings.logo && <img src={settings.logo} className="w-14 h-14 object-contain" />}
          <div className="text-[12px]">
            <div className="font-bold text-[15px]">{settings.store}</div>
            <div>{settings.addr}</div>
            <div>{settings.phone}</div>
            <div>{settings.email}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-bold tracking-wide mb-1">{settings.invoiceTitle}</div>
          <table className="text-[11px] ml-auto">
            <tbody>
              <tr>
                <td className="pr-2 text-gray-500">No.</td>
                <td className="font-medium">{sale.no}</td>
              </tr>
              <tr>
                <td className="pr-2 text-gray-500">Date</td>
                <td className="font-medium">{formatDateTime(sale.ts)}</td>
              </tr>
              <tr>
                <td className="pr-2 text-gray-500">Served by</td>
                <td className="font-medium">{cashierName}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="h-[2px] bg-black my-4" />

      <div className="flex justify-between items-start mb-4">
        <div className="text-[12px]">
          <div className="text-gray-500 mb-1">Billed to</div>
          <div className="font-semibold">{customerName ?? "Walk-in customer"}</div>
          {customerPhone && <div>{customerPhone}</div>}
        </div>
        <div
          className="px-4 py-1.5 border-2 rounded font-bold text-[13px] -rotate-6"
          style={{ borderColor: stampColor, color: stampColor }}
        >
          {status}
        </div>
      </div>

      <table className="items w-full text-[11px] mb-4" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#111", color: "#fff" }}>
            <th className="text-left py-2 px-2 font-medium">#</th>
            <th className="text-left py-2 px-2 font-medium">Description</th>
            <th className="text-right py-2 px-2 font-medium">Qty</th>
            <th className="text-right py-2 px-2 font-medium">Unit price</th>
            <th className="text-right py-2 px-2 font-medium">Disc.</th>
            <th className="text-right py-2 px-2 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((l, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? "#f3f3f1" : "#fff" }}>
              <td className="py-1.5 px-2">{i + 1}</td>
              <td className="py-1.5 px-2">
                {l.name}
                <div className="text-gray-400 text-[10px]">{l.sku}</div>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">{l.qty}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmt(l.unitPrice)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{l.discountPct > 0 ? `${l.discountPct}%` : "—"}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{fmt(Math.round(l.unitPrice * l.qty * (1 - l.discountPct / 100)))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-start gap-6">
        <div className="text-[11px] flex-1">
          <div className="font-medium mb-1">Payments</div>
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between max-w-[220px]">
              <span className="capitalize">{p.method}</span>
              <span className="tabular-nums">{fmt(p.amount)}</span>
            </div>
          ))}
          {sale.change > 0 && (
            <div className="flex justify-between max-w-[220px]">
              <span>Change</span>
              <span className="tabular-nums">{fmt(sale.change)}</span>
            </div>
          )}
          <div className="mt-3 text-gray-500">Amount in words</div>
          <div className="italic">{amountInWords(sale.total)} {settings.currency}</div>
        </div>

        <table className="amt-table text-[12px]" style={{ minWidth: 220 }}>
          <tbody>
            <tr>
              <td className="py-1 text-gray-500">Subtotal</td>
              <td className="py-1 text-right tabular-nums">{fmt(sale.subtotal + sale.discount)}</td>
            </tr>
            {sale.discount > 0 && (
              <tr>
                <td className="py-1 text-gray-500">Discount</td>
                <td className="py-1 text-right tabular-nums">−{fmt(sale.discount)}</td>
              </tr>
            )}
            <tr>
              <td className="py-1 text-gray-500">Tax ({(settings.taxRate * 100).toFixed(1)}%)</td>
              <td className="py-1 text-right tabular-nums">{fmt(sale.tax)}</td>
            </tr>
            <tr>
              <td className="py-2 font-bold border-t-2 border-black">TOTAL</td>
              <td className="py-2 text-right font-bold border-t-2 border-black tabular-nums">{fmt(sale.total)}</td>
            </tr>
            <tr>
              <td className="py-1 text-gray-500">Paid</td>
              <td className="py-1 text-right tabular-nums">{fmt(paidTotal)}</td>
            </tr>
            {refundedTotal > 0 && (
              <tr>
                <td className="py-1 text-gray-500">Refunded</td>
                <td className="py-1 text-right tabular-nums">{fmt(refundedTotal)}</td>
              </tr>
            )}
            {balanceDue > 0 && (
              <tr>
                <td className="py-1 font-semibold" style={{ color: "#fab219" }}>
                  Balance due
                </td>
                <td className="py-1 text-right font-semibold tabular-nums" style={{ color: "#fab219" }}>
                  {fmt(balanceDue)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="absolute bottom-[16mm] left-[15mm] right-[15mm] text-[10px] text-gray-500 flex justify-between border-t pt-2">
        <span>{settings.receiptFooter}</span>
        <span>
          {sale.no} · {sale.lines.length} item{sale.lines.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

const DOC_STYLES = `
@media print {
  body * { visibility: hidden; }
  #doc-print-area, #doc-print-area * { visibility: visible; }
  #doc-print-area { position: absolute; left: 0; top: 0; height: auto !important; max-height: none !important; overflow: visible !important; }
  .doc-shell { height: auto !important; max-height: none !important; overflow: visible !important; }
  .no-print { display: none !important; }
  .app-shell, .app-rail, .app-topbar { display: none !important; }
  .app-main, .app-view { height: auto !important; overflow: visible !important; }
  @page { size: A4; margin: 0; }
}
`;
