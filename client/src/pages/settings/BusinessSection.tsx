import { useEffect, useState } from "react";
import { trpc } from "../../trpc";
import { useAuth } from "../../lib/auth";
import { can, formatMoney, formatDateTime } from "@thoth/shared";
import { Button, Field, inputStyle, Switch } from "../../components/ui";

export default function BusinessSection() {
  const { user } = useAuth();
  const settingsQuery = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation();
  const latestSaleQuery = trpc.sales.list.useQuery({});
  const canEdit = can(user?.perms, "settings", "edit");

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (settingsQuery.data && !form) setForm(settingsQuery.data);
  }, [settingsQuery.data]);

  if (!form) return null;

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 900_000) {
      alert("Logo image is too large (max ~900KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f: any) => ({ ...f, logo: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  const latestSale = latestSaleQuery.data?.[0];

  return (
    <div className="p-[18px] grid grid-cols-[1fr_360px] gap-6 max-w-[1100px]">
      <div className="flex flex-col gap-4">
        <h2 className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
          Business & invoice
        </h2>

        <div className="flex items-center gap-4">
          {form.logo ? (
            <img src={form.logo} className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: "var(--line)" }} />
          ) : (
            <div className="w-16 h-16 rounded-lg flex items-center justify-center text-[11px]" style={{ background: "var(--surface-3)", color: "var(--ink-3)" }}>
              No logo
            </div>
          )}
          <div className="flex gap-2">
            <label className="px-3 py-1.5 rounded-lg text-[13px] font-medium cursor-pointer" style={{ background: "var(--surface-3)" }}>
              Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
            </label>
            {form.logo && (
              <button className="px-3 py-1.5 rounded-lg text-[13px]" style={{ color: "var(--crit)" }} onClick={() => setForm({ ...form, logo: "" })}>
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Business name">
            <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} />
          </Field>
          <Field label="Address">
            <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.addr} onChange={(e) => setForm({ ...form, addr: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Document title">
            <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.invoiceTitle} onChange={(e) => setForm({ ...form, invoiceTitle: e.target.value })} />
          </Field>
          <Field label="Default document">
            <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.docFormat} onChange={(e) => setForm({ ...form, docFormat: e.target.value })}>
              <option value="receipt">Receipt (80mm)</option>
              <option value="a4">A4 Invoice</option>
            </select>
          </Field>
          <Field label="Currency symbol">
            <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </Field>
          <Field label="Sales tax rate %">
            <input
              type="number"
              className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums"
              style={inputStyle}
              value={(form.taxRate * 100).toString()}
              onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) / 100 })}
            />
          </Field>
          <Field label="Footer line">
            <input className="w-full px-3 py-2 text-[14px] border outline-none col-span-2" style={inputStyle} value={form.receiptFooter} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })} />
          </Field>
        </div>

        <Switch checked={form.showLogoOnInvoice} onChange={(v) => setForm({ ...form, showLogoOnInvoice: v })} label="Show logo on printed invoices" />

        {canEdit && (
          <div>
            <Button onClick={() => updateMutation.mutate(form)}>Save changes</Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-3)" }}>
          Invoice preview
        </h3>
        <div className="rounded-[10px] p-4 text-[12px] font-mono bg-white text-black border" style={{ borderColor: "var(--line)" }}>
          {form.logo && <img src={form.logo} className="w-10 mb-2" />}
          <div className="font-bold">{form.store || "Business name"}</div>
          <div>{form.addr}</div>
          <div>{form.phone}</div>
          <div className="mt-1 font-bold">{form.invoiceTitle}</div>
          {latestSale ? (
            <>
              <div className="flex justify-between mt-1">
                <span>{latestSale.no}</span>
                <span>{formatDateTime(latestSale.ts)}</span>
              </div>
              <div className="border-t border-dashed my-1" />
              {latestSale.lines.slice(0, 3).map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <span>{formatMoney(l.unitPrice * l.qty, form.currency)}</span>
                </div>
              ))}
              <div className="border-t border-dashed my-1" />
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>{formatMoney(latestSale.total, form.currency)}</span>
              </div>
            </>
          ) : (
            <div className="mt-2 text-gray-400">No sales yet to preview.</div>
          )}
          <div className="border-t border-dashed my-1" />
          <div className="text-center">{form.receiptFooter}</div>
        </div>
      </div>
    </div>
  );
}
