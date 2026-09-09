import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../../trpc";
import { useAuth } from "../../lib/auth";
import { useFormatMoney } from "../../lib/settings";
import { can } from "@thoth/shared";
import { Button, EmptyState, Field, inputStyle, Modal } from "../../components/ui";

export default function BrandsTab() {
  const { user } = useAuth();
  const fmt = useFormatMoney();
  const navigate = useNavigate();
  const brandsQuery = trpc.brands.list.useQuery();
  const productsQuery = trpc.products.list.useQuery({ status: "all" });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.brands.delete.useMutation();
  const [editing, setEditing] = useState<any | null | "new">(null);

  const productsByBrand = new Map<string, typeof productsQuery.data>();
  for (const p of productsQuery.data ?? []) {
    if (!p.brandId) continue;
    const arr = productsByBrand.get(p.brandId) ?? [];
    arr.push(p);
    productsByBrand.set(p.brandId, arr as any);
  }

  return (
    <div className="p-[18px] flex flex-col gap-4">
      <div className="flex justify-end">
        {can(user?.perms, "catalog", "create") && <Button onClick={() => setEditing("new")}>Add brand</Button>}
      </div>
      <div className="rounded-[10px] overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left uppercase text-[11px]" style={{ color: "var(--ink-3)" }}>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5 text-right">Products</th>
              <th className="px-3 py-2.5 text-right">Units</th>
              <th className="px-3 py-2.5 text-right">Stock value</th>
              <th className="px-3 py-2.5 text-right">Avg. margin</th>
              <th className="px-3 py-2.5" />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {brandsQuery.data?.map((b) => {
              const products = productsByBrand.get(b.id) ?? [];
              const units = products.reduce((s, p) => s + p.stock, 0);
              const stockValue = products.reduce((s, p) => s + p.stock * p.cost, 0);
              const margins = products.filter((p) => p.price > 0).map((p) => ((p.price - p.cost) / p.price) * 100);
              const avgMargin = margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : null;
              const lowCount = products.filter((p) => p.active && p.stock <= p.lowAt).length;
              return (
                <tr key={b.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2.5 font-medium">
                    {b.name}
                    {lowCount > 0 && (
                      <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--warn) 20%, transparent)", color: "#8a5a00" }}>
                        {lowCount} low stock
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{products.length}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{units}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(stockValue)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{avgMargin === null ? "—" : `${avgMargin.toFixed(1)}%`}</td>
                  <td className="px-3 py-2.5">
                    <button style={{ color: "var(--brand)" }} onClick={() => navigate(`/catalog/products?brand=${b.id}`)}>
                      Products
                    </button>
                  </td>
                  <td className="px-3 py-2.5 flex gap-2">
                    {can(user?.perms, "catalog", "edit") && (
                      <button style={{ color: "var(--ink-3)" }} onClick={() => setEditing(b)}>
                        Edit
                      </button>
                    )}
                    {can(user?.perms, "catalog", "delete") && (
                      <button
                        style={{ color: "var(--crit)" }}
                        onClick={async () => {
                          if (!confirm(`Delete ${b.name}? Its products stay, just unassigned.`)) return;
                          await deleteMutation.mutateAsync(b.id);
                          utils.brands.list.invalidate();
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
        {!brandsQuery.data?.length && <EmptyState text="No brands yet. Add one to start organizing your products." />}
      </div>
      {editing && <BrandEditor brand={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BrandEditor({ brand, onClose }: { brand: any | null; onClose: () => void }) {
  const [name, setName] = useState(brand?.name ?? "");
  const [note, setNote] = useState(brand?.note ?? "");
  const utils = trpc.useUtils();
  const createMutation = trpc.brands.create.useMutation();
  const updateMutation = trpc.brands.update.useMutation();

  return (
    <Modal
      open
      onClose={onClose}
      title={brand ? "Edit brand" : "Add brand"}
      footer={
        <>
          <span />
          <Button
            onClick={async () => {
              if (brand) await updateMutation.mutateAsync({ id: brand.id, patch: { name, note } });
              else await createMutation.mutateAsync({ name, note });
              utils.brands.list.invalidate();
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Note">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
