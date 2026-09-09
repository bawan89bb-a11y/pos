import { useState } from "react";
import { trpc } from "../../trpc";
import { Modal, Button, Field, inputStyle } from "../../components/ui";
import { useFormatMoney } from "../../lib/settings";
import { markupPct, marginPct, priceFromTargetMargin } from "@thoth/shared";
import type { Product } from "@thoth/shared";

export function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fmt = useFormatMoney();
  const brandsQuery = trpc.brands.list.useQuery();
  const suppliersQuery = trpc.suppliers.list.useQuery();
  const createBrand = trpc.brands.create.useMutation();
  const createSupplier = trpc.suppliers.create.useMutation();
  const createMutation = trpc.products.create.useMutation();
  const updateMutation = trpc.products.update.useMutation();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    name: product?.name ?? "",
    brandId: product?.brandId ?? null,
    supplierId: product?.supplierId ?? null,
    sku: product?.sku ?? "",
    category: product?.category ?? "",
    tags: (product?.tags ?? []).join(", "),
    poRef: product?.poRef ?? "",
    expiry: product?.expiry ?? "",
    expiryWarnMonths: product?.expiryWarnMonths ?? null,
    active: product?.active ?? true,
    cost: product ? (product.cost / 100).toFixed(2) : "0.00",
    price: product ? (product.price / 100).toFixed(2) : "0.00",
    stock: product?.stock ?? 0,
    lowAt: product?.lowAt ?? 0,
    color: product?.color ?? "#5433eb",
    taxable: product?.taxable ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const costCents = Math.round(parseFloat(form.cost || "0") * 100);
  const priceCents = Math.round(parseFloat(form.price || "0") * 100);
  const profit = priceCents - costCents;
  const markup = markupPct(costCents, priceCents);
  const margin = marginPct(costCents, priceCents);
  const belowCost = priceCents < costCents;

  async function save() {
    setError(null);
    const payload = {
      name: form.name,
      brandId: form.brandId,
      supplierId: form.supplierId,
      sku: form.sku,
      category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      poRef: form.poRef,
      expiry: form.expiry || null,
      expiryWarnMonths: form.expiryWarnMonths,
      active: form.active,
      cost: costCents,
      price: priceCents,
      stock: Number(form.stock),
      lowAt: Number(form.lowAt),
      color: form.color,
      taxable: form.taxable,
    };
    try {
      if (product) await updateMutation.mutateAsync({ id: product.id, patch: payload });
      else await createMutation.mutateAsync(payload);
      utils.brands.list.invalidate();
      utils.suppliers.list.invalidate();
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Could not save this product");
    }
  }

  async function addBrand() {
    const name = prompt("New brand name");
    if (!name) return;
    const b = await createBrand.mutateAsync({ name });
    utils.brands.list.invalidate();
    setForm({ ...form, brandId: b.id });
  }

  async function addSupplier() {
    const name = prompt("New supplier name");
    if (!name) return;
    const s = await createSupplier.mutateAsync({ name, contact: "", phone: "", email: "", note: "" });
    utils.suppliers.list.invalidate();
    setForm({ ...form, supplierId: s.id });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? "Edit product" : "Add product"}
      width={640}
      footer={
        <>
          {error ? <span className="text-[13px]" style={{ color: "var(--crit)" }}>{error}</span> : <span />}
          <Button onClick={save}>Save product</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="SKU">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </Field>

        <Field label="Brand">
          <div className="flex gap-1">
            <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.brandId ?? ""} onChange={(e) => setForm({ ...form, brandId: e.target.value || null })}>
              <option value="">No brand</option>
              {brandsQuery.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={addBrand}>
              +
            </Button>
          </div>
        </Field>
        <Field label="Supplier">
          <div className="flex gap-1">
            <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.supplierId ?? ""} onChange={(e) => setForm({ ...form, supplierId: e.target.value || null })}>
              <option value="">No supplier</option>
              {suppliersQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={addSupplier}>
              +
            </Button>
          </div>
        </Field>

        <Field label="Category">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <Field label="Tags (comma separated)">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </Field>

        <Field label="Supplier code / PO number">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.poRef} onChange={(e) => setForm({ ...form, poRef: e.target.value })} />
        </Field>
        <Field label="Expiry date">
          <input type="date" className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.expiry ?? ""} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
        </Field>

        <Field label="Tile colour">
          <input type="color" className="w-full h-[38px] px-1 py-1 border outline-none" style={inputStyle} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        </Field>
        <Field label="Status">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.active ? "active" : "inactive"} onChange={(e) => setForm({ ...form, active: e.target.value === "active" })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>

        <Field label="Cost price">
          <input className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums" style={inputStyle} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
        </Field>
        <Field label="Retail price">
          <input className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums" style={inputStyle} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </Field>

        <Field label="Stock on hand">
          <input type="number" className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums" style={inputStyle} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
        </Field>
        <Field label="Low-stock alert at">
          <input type="number" className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums" style={inputStyle} value={form.lowAt} onChange={(e) => setForm({ ...form, lowAt: Number(e.target.value) })} />
        </Field>

        <label className="flex items-center gap-2 text-[13px] col-span-2">
          <input type="checkbox" checked={form.taxable} onChange={(e) => setForm({ ...form, taxable: e.target.checked })} />
          Taxable
        </label>
      </div>

      <div className="mt-4 rounded-lg p-3 text-[13px]" style={{ background: belowCost ? "color-mix(in srgb, var(--crit) 10%, transparent)" : "var(--surface-2)" }}>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <div style={{ color: "var(--ink-3)" }}>Profit / unit</div>
            <div className="tabular-nums font-medium" style={{ color: belowCost ? "var(--crit)" : "var(--ink)" }}>{fmt(profit)}</div>
          </div>
          <div>
            <div style={{ color: "var(--ink-3)" }}>Markup</div>
            <div className="tabular-nums font-medium">{markup === null ? "—" : `${markup.toFixed(1)}%`}</div>
          </div>
          <div>
            <div style={{ color: "var(--ink-3)" }}>Margin</div>
            <div className="tabular-nums font-medium" style={{ color: belowCost ? "var(--crit)" : "var(--ink)" }}>{margin === null ? "—" : `${margin.toFixed(1)}%`}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {[30, 40, 50, 60].map((m) => (
            <button
              key={m}
              className="px-2.5 py-1 rounded text-[12px]"
              style={{ background: "var(--surface-3)" }}
              onClick={() => setForm({ ...form, price: (priceFromTargetMargin(costCents, m) / 100).toFixed(2) })}
            >
              {m}% margin
            </button>
          ))}
        </div>
        {belowCost && <p className="mt-2 text-[12px]" style={{ color: "var(--crit)" }}>Retail is below cost.</p>}
      </div>
    </Modal>
  );
}
