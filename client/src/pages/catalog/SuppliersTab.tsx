import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../../trpc";
import { useAuth } from "../../lib/auth";
import { useFormatMoney } from "../../lib/settings";
import { can } from "@thoth/shared";
import { Button, EmptyState, Field, inputStyle, Modal } from "../../components/ui";

export default function SuppliersTab() {
  const { user } = useAuth();
  const fmt = useFormatMoney();
  const navigate = useNavigate();
  const suppliersQuery = trpc.suppliers.list.useQuery();
  const productsQuery = trpc.products.list.useQuery({ status: "all" });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.suppliers.delete.useMutation();
  const [editing, setEditing] = useState<any | null | "new">(null);
  const [reorderSupplier, setReorderSupplier] = useState<any | null>(null);

  const productsBySupplier = new Map<string, typeof productsQuery.data>();
  for (const p of productsQuery.data ?? []) {
    if (!p.supplierId) continue;
    const arr = productsBySupplier.get(p.supplierId) ?? [];
    arr.push(p);
    productsBySupplier.set(p.supplierId, arr as any);
  }

  return (
    <div className="p-[18px] flex flex-col gap-4">
      <div className="flex justify-end">
        {can(user?.perms, "catalog", "create") && <Button onClick={() => setEditing("new")}>Add supplier</Button>}
      </div>
      <div className="rounded-[10px] overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left uppercase text-[11px]" style={{ color: "var(--ink-3)" }}>
              <th className="px-3 py-2.5">Supplier</th>
              <th className="px-3 py-2.5">Contact</th>
              <th className="px-3 py-2.5 text-right">Products</th>
              <th className="px-3 py-2.5 text-right">Stock value</th>
              <th className="px-3 py-2.5 text-right">To reorder</th>
              <th className="px-3 py-2.5" />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {suppliersQuery.data?.map((s) => {
              const products = productsBySupplier.get(s.id) ?? [];
              const stockValue = products.reduce((sum, p) => sum + p.stock * p.cost, 0);
              const toReorder = products.filter((p) => p.active && p.stock <= p.lowAt);
              return (
                <tr key={s.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2.5 font-medium">{s.name}</td>
                  <td className="px-3 py-2.5" style={{ color: "var(--ink-3)" }}>
                    {s.contact} · {s.phone} · {s.email}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{products.length}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(stockValue)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {toReorder.length > 0 ? (
                      <button style={{ color: "var(--warn)" }} onClick={() => setReorderSupplier({ ...s, toReorder })}>
                        {toReorder.length}
                      </button>
                    ) : (
                      0
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button style={{ color: "var(--brand)" }} onClick={() => navigate(`/catalog/products?supplier=${s.id}`)}>
                      Products
                    </button>
                  </td>
                  <td className="px-3 py-2.5 flex gap-2">
                    {can(user?.perms, "catalog", "edit") && (
                      <button style={{ color: "var(--ink-3)" }} onClick={() => setEditing(s)}>
                        Edit
                      </button>
                    )}
                    {can(user?.perms, "catalog", "delete") && (
                      <button
                        style={{ color: "var(--crit)" }}
                        onClick={async () => {
                          if (!confirm(`Delete ${s.name}? Its products stay, just unassigned.`)) return;
                          await deleteMutation.mutateAsync(s.id);
                          utils.suppliers.list.invalidate();
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!suppliersQuery.data?.length && <EmptyState text="No suppliers yet. Add one to track where your stock comes from." />}
      </div>
      {editing && <SupplierEditor supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {reorderSupplier && <ReorderListModal supplier={reorderSupplier} fmt={fmt} onClose={() => setReorderSupplier(null)} />}
    </div>
  );
}

function ReorderListModal({ supplier, fmt, onClose }: { supplier: any; fmt: (c: number) => string; onClose: () => void }) {
  const lines = supplier.toReorder.map((p: any) => {
    const qty = Math.max(p.lowAt * 2 - p.stock, 0);
    return { ...p, reorderQty: qty, estCost: qty * p.cost };
  });
  const total = lines.reduce((s: number, l: any) => s + l.estCost, 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reorder list · ${supplier.name}`}
      width={560}
      footer={
        <>
          <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
            Order total: {fmt(total)}
          </span>
          <Button onClick={() => window.print()}>Print</Button>
        </>
      }
    >
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left uppercase text-[11px]" style={{ color: "var(--ink-3)" }}>
            <th className="py-1.5">Product</th>
            <th className="py-1.5 text-right">Stock</th>
            <th className="py-1.5 text-right">Reorder qty</th>
            <th className="py-1.5 text-right">Est. cost</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l: any) => (
            <tr key={l.id} className="border-t" style={{ borderColor: "var(--line)" }}>
              <td className="py-1.5">{l.name}</td>
              <td className="py-1.5 text-right tabular-nums">{l.stock}</td>
              <td className="py-1.5 text-right tabular-nums">{l.reorderQty}</td>
              <td className="py-1.5 text-right tabular-nums">{fmt(l.estCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function SupplierEditor({ supplier, onClose }: { supplier: any | null; onClose: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contact: supplier?.contact ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    note: supplier?.note ?? "",
  });
  const utils = trpc.useUtils();
  const createMutation = trpc.suppliers.create.useMutation();
  const updateMutation = trpc.suppliers.update.useMutation();

  return (
    <Modal
      open
      onClose={onClose}
      title={supplier ? "Edit supplier" : "Add supplier"}
      footer={
        <>
          <span />
          <Button
            onClick={async () => {
              if (supplier) await updateMutation.mutateAsync({ id: supplier.id, patch: form });
              else await createMutation.mutateAsync(form);
              utils.suppliers.list.invalidate();
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Contact">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Payment terms">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
