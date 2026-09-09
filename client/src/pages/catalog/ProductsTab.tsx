import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { trpc } from "../../trpc";
import { useAuth } from "../../lib/auth";
import { useFormatMoney } from "../../lib/settings";
import { can, marginPct, expiryLevel, expiryLabel } from "@thoth/shared";
import type { Product } from "@thoth/shared";
import { Button, Pill, Switch, EmptyState, Field, inputStyle } from "../../components/ui";
import { ProductEditor } from "./ProductEditor";
import { ImportDialog } from "./ImportDialog";
import { formatDate } from "@thoth/shared";

export default function ProductsTab() {
  const { user } = useAuth();
  const fmt = useFormatMoney();
  const [searchParams] = useSearchParams();
  const initial = {
    search: "",
    supplierId: searchParams.get("supplier") ?? "",
    brandId: searchParams.get("brand") ?? "",
    status: "active" as "active" | "inactive" | "all",
    expiry: "any" as "any" | "expiringSoon" | "expired" | "noDate",
  };
  const [staged, setStaged] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [importing, setImporting] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "price" | "created">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const productsQuery = trpc.products.list.useQuery(applied);
  const brandsQuery = trpc.brands.list.useQuery();
  const suppliersQuery = trpc.suppliers.list.useQuery();
  const settingsQuery = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const bulkActive = trpc.products.bulkSetActive.useMutation();
  const bulkDelete = trpc.products.bulkDelete.useMutation();
  const updateMutation = trpc.products.update.useMutation();

  const brandName = new Map((brandsQuery.data ?? []).map((b) => [b.id, b.name]));
  const supplierName = new Map((suppliersQuery.data ?? []).map((s) => [s.id, s.name]));

  const sorted = useMemo(() => {
    const list = [...(productsQuery.data ?? [])];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "price") cmp = a.price - b.price;
      else cmp = a.createdAt - b.createdAt;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [productsQuery.data, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelectAll() {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((p) => p.id)));
  }

  function exportCsv() {
    const header = ["Name", "SKU", "Category", "Cost", "Retail", "Stock"];
    const rows = sorted.map((p) => [p.name, p.sku, p.category, (p.cost / 100).toFixed(2), (p.price / 100).toFixed(2), String(p.stock)]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "products.csv";
    a.click();
  }

  return (
    <div className="p-[18px] flex flex-col gap-4">
      <div className="rounded-[10px] p-3 flex items-center justify-between" style={{ background: "var(--surface-3)" }}>
        <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
          Add, view and edit your products in one place.{" "}
          <a href="#" className="underline" style={{ color: "var(--brand)" }}>
            Need help?
          </a>
        </p>
        <div className="flex gap-2">
          {can(user?.perms, "catalog", "create") && (
            <Button variant="secondary" onClick={() => setImporting(true)}>
              Import
            </Button>
          )}
          {can(user?.perms, "catalog", "create") && <Button onClick={() => setEditing("new")}>Add product</Button>}
        </div>
      </div>

      <div className="rounded-[10px] p-4 grid grid-cols-4 gap-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <Field label="Search for products">
          <input
            className="w-full px-3 py-2 text-[14px] border outline-none"
            style={inputStyle}
            value={staged.search}
            onChange={(e) => setStaged({ ...staged, search: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && setApplied(staged)}
          />
        </Field>
        <Field label="Supplier">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={staged.supplierId} onChange={(e) => setStaged({ ...staged, supplierId: e.target.value })}>
            <option value="">All suppliers</option>
            {suppliersQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Brand">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={staged.brandId} onChange={(e) => setStaged({ ...staged, brandId: e.target.value })}>
            <option value="">All brands</option>
            {brandsQuery.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={staged.status} onChange={(e) => setStaged({ ...staged, status: e.target.value as any })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </Field>
        <Field label="Expiry">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={staged.expiry} onChange={(e) => setStaged({ ...staged, expiry: e.target.value as any })}>
            <option value="any">Any</option>
            <option value="expiringSoon">Expiring soon</option>
            <option value="expired">Expired</option>
            <option value="noDate">No expiry date</option>
          </select>
        </Field>
        <div className="flex gap-2 items-end">
          <Button onClick={() => setApplied(staged)}>Search</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const cleared = { search: "", supplierId: "", brandId: "", status: "active" as const, expiry: "any" as const };
              setStaged(cleared);
              setApplied(cleared);
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center text-[13px]" style={{ color: "var(--ink-3)" }}>
        <span>
          Displaying {sorted.length} {applied.status} products
        </span>
        {can(user?.perms, "catalog", "export") && (
          <button className="font-medium" style={{ color: "var(--brand)" }} onClick={exportCsv}>
            Export list
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="rounded-[10px] p-3 flex items-center gap-3 text-[13px]" style={{ background: "var(--brand-soft)" }}>
          <span>{selected.size} selected</span>
          {can(user?.perms, "catalog", "edit") && (
            <>
              <button
                className="font-medium"
                style={{ color: "var(--brand)" }}
                onClick={async () => {
                  await bulkActive.mutateAsync({ ids: [...selected], active: true });
                  utils.products.list.invalidate();
                  setSelected(new Set());
                }}
              >
                Set active
              </button>
              <button
                className="font-medium"
                style={{ color: "var(--brand)" }}
                onClick={async () => {
                  await bulkActive.mutateAsync({ ids: [...selected], active: false });
                  utils.products.list.invalidate();
                  setSelected(new Set());
                }}
              >
                Set inactive
              </button>
            </>
          )}
          {can(user?.perms, "catalog", "delete") && (
            <button
              className="font-medium"
              style={{ color: "var(--crit)" }}
              onClick={async () => {
                if (!confirm(`Delete ${selected.size} products?`)) return;
                await bulkDelete.mutateAsync([...selected]);
                utils.products.list.invalidate();
                setSelected(new Set());
              }}
            >
              Delete
            </button>
          )}
          <button className="ml-auto" style={{ color: "var(--ink-3)" }} onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className="rounded-[10px] overflow-hidden overflow-x-auto" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left uppercase text-[11px]" style={{ color: "var(--ink-3)" }}>
              <th className="px-3 py-2.5">
                <input type="checkbox" checked={selected.size > 0 && selected.size === sorted.length} onChange={toggleSelectAll} />
              </th>
              <th className="px-3 py-2.5">
                <SortButton label="Product" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              </th>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5">Supplier</th>
              <th className="px-3 py-2.5 text-right">Special order</th>
              <th className="px-3 py-2.5 text-right">Available</th>
              <th className="px-3 py-2.5 text-right">
                <SortButton label="Retail price" active={sortKey === "price"} dir={sortDir} onClick={() => toggleSort("price")} />
              </th>
              <th className="px-3 py-2.5">Expires</th>
              <th className="px-3 py-2.5">Active</th>
              <th className="px-3 py-2.5">
                <SortButton label="Created" active={sortKey === "created"} dir={sortDir} onClick={() => toggleSort("created")} />
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const margin = marginPct(p.cost, p.price);
              const level = expiryLevel(p.expiry, Date.now(), p.expiryWarnMonths ?? settingsQuery.data?.expiryWarnMonths ?? 6, settingsQuery.data?.expiryUrgentMonths ?? 3);
              return (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(p.id) : next.delete(p.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded shrink-0" style={{ background: p.color }} />
                      <div className="min-w-0">
                        <div className="font-medium truncate" style={{ color: "var(--ink)" }}>
                          {p.name}
                        </div>
                        <div className="text-[11px] truncate" style={{ color: "var(--ink-3)" }}>
                          {p.sku} · {p.category}
                          {p.tags.length ? ` · ${p.tags.join(", ")}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{p.brandId ? brandName.get(p.brandId) : "—"}</td>
                  <td className="px-3 py-2.5">{p.supplierId ? supplierName.get(p.supplierId) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{(p as any).specialOrderDemand ?? 0}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{(p as any).availableToSell ?? p.stock}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="tabular-nums font-medium">{fmt(p.price)}</div>
                    <div className="text-[11px] tabular-nums" style={{ color: "var(--ink-3)" }}>
                      {margin === null ? "—" : `${margin.toFixed(1)}% margin`}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {level === "none" ? (
                      <span style={{ color: "var(--ink-3)" }}>—</span>
                    ) : (
                      <Pill tone={level === "expired" ? "crit" : level === "urgent" ? "warn" : level === "warn" ? "neutral" : "good"}>
                        {expiryLabel(p.expiry, Date.now())}
                      </Pill>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Switch
                      checked={p.active}
                      onChange={async (v) => {
                        await updateMutation.mutateAsync({ id: p.id, patch: { active: v } });
                        utils.products.list.invalidate();
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--ink-3)" }}>
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    {can(user?.perms, "catalog", "edit") && (
                      <button style={{ color: "var(--ink-3)" }} onClick={() => setEditing(p)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && <EmptyState text="No products match these filters. Try clearing them or add a new product." />}
      </div>

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            utils.products.list.invalidate();
          }}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} onDone={() => { setImporting(false); utils.products.list.invalidate(); }} />}
    </div>
  );
}

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="underline underline-offset-2">
      {label} {active ? (dir === "asc" ? "↑" : "↓") : ""}
    </button>
  );
}
