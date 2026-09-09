import { useMemo, useState } from "react";
import { AppShell } from "../components/Shell";
import { trpc } from "../trpc";
import { useAuth } from "../lib/auth";
import { useFormatMoney } from "../lib/settings";
import { resolveDatePreset, formatDateTime, can, toCsv, type DatePresetId } from "@thoth/shared";
import type { Expense, ExpenseType } from "@thoth/shared";
import { Button, EmptyState, Field, inputStyle, Modal, Pill } from "../components/ui";

const PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "prevMonth", label: "Previous month" },
  { id: "allTime", label: "All time" },
];

export default function Expenses() {
  const { user } = useAuth();
  const fmt = useFormatMoney();
  const [preset, setPreset] = useState<DatePresetId>("thisMonth");
  const [typeId, setTypeId] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Expense | null | "new">(null);
  const [typeManagerOpen, setTypeManagerOpen] = useState(false);

  const range = useMemo(() => resolveDatePreset(preset), [preset]);
  const expensesQuery = trpc.expenses.list.useQuery({ from: range.from, to: range.to, typeId: typeId || undefined, search: search || undefined });
  const typesQuery = trpc.expenseTypes.list.useQuery();
  const utils = trpc.useUtils();
  const renewMutation = trpc.expenses.renew.useMutation();

  const typeById = new Map((typesQuery.data ?? []).map((t) => [t.id, t]));
  const total = expensesQuery.data?.reduce((s, e) => s + e.amount, 0) ?? 0;
  const byType = new Map<string, number>();
  for (const e of expensesQuery.data ?? []) byType.set(e.typeId, (byType.get(e.typeId) ?? 0) + e.amount);
  let largestType: { name: string; total: number } | null = null;
  for (const [id, t] of byType) {
    const type = typeById.get(id);
    if (type && (!largestType || t > largestType.total)) largestType = { name: type.name, total: t };
  }

  function exportCsv() {
    const rows = (expensesQuery.data ?? []).map((e) => [formatDateTime(e.ts), typeById.get(e.typeId)?.name ?? "", e.vendor, e.method, (e.amount / 100).toFixed(2), e.note]);
    const csv = toCsv(["Date", "Type", "Vendor", "Method", "Amount", "Note"], rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "expenses.csv";
    a.click();
  }

  return (
    <AppShell title="Expenses" actions={can(user?.perms, "expenses", "create") ? <Button size="sm" onClick={() => setEditing("new")}>Record expense</Button> : undefined}>
      <div className="p-[18px] flex flex-col gap-4">
        <div className="rounded-[10px] p-4 grid grid-cols-4 gap-3 items-end" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <Field label="Date range">
            <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={preset} onChange={(e) => setPreset(e.target.value as DatePresetId)}>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">All types</option>
              {typesQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search vendor">
            <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
          <Button variant="secondary" onClick={() => setTypeManagerOpen(true)}>
            Manage expense types
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Tile label="Total expenses" value={fmt(total)} />
          <Tile label="Entries" value={String(expensesQuery.data?.length ?? 0)} />
          <Tile label="Largest type" value={largestType ? `${largestType.name} · ${fmt(largestType.total)}` : "—"} />
          <Tile label="Types used" value={String(byType.size)} />
        </div>

        <div className="flex justify-end">
          {can(user?.perms, "expenses", "export") && (
            <button className="text-[13px] font-medium" style={{ color: "var(--brand)" }} onClick={exportCsv}>
              Export list
            </button>
          )}
        </div>

        <div className="rounded-[10px] overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left uppercase text-[11px]" style={{ color: "var(--ink-3)" }}>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Vendor</th>
                <th className="px-3 py-2.5">Paid by</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {expensesQuery.data?.map((e) => {
                const type = typeById.get(e.typeId);
                return (
                  <tr key={e.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--ink-3)" }}>
                      {formatDateTime(e.ts)}
                    </td>
                    <td className="px-3 py-2.5">
                      {type && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: type.color }} />
                          {type.name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{e.vendor}</td>
                    <td className="px-3 py-2.5" style={{ color: "var(--ink-3)" }}>
                      {e.method}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmt(e.amount)}</td>
                    <td className="px-3 py-2.5 flex gap-2 justify-end">
                      {can(user?.perms, "expenses", "renew") && (
                        <button
                          style={{ color: "var(--brand)" }}
                          onClick={async () => {
                            await renewMutation.mutateAsync(e.id);
                            utils.expenses.list.invalidate();
                          }}
                        >
                          Renew
                        </button>
                      )}
                      {can(user?.perms, "expenses", "edit") && (
                        <button style={{ color: "var(--ink-3)" }} onClick={() => setEditing(e)}>
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {!!expensesQuery.data?.length && (
              <tfoot>
                <tr className="border-t font-semibold" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2.5" colSpan={4}>
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
          {!expensesQuery.data?.length && <EmptyState text="No expenses recorded in this range yet." />}
        </div>
      </div>

      {editing && (
        <ExpenseEditor
          expense={editing === "new" ? null : editing}
          types={typesQuery.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            utils.expenses.list.invalidate();
          }}
        />
      )}
      {typeManagerOpen && <ExpenseTypeManager onClose={() => setTypeManagerOpen(false)} />}
    </AppShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div className="text-[12px] mb-1" style={{ color: "var(--ink-3)" }}>
        {label}
      </div>
      <div className="text-[18px] font-semibold tabular-nums truncate" style={{ color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function ExpenseEditor({
  expense,
  types,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  types: ExpenseType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    typeId: expense?.typeId ?? types[0]?.id ?? "",
    amount: expense ? (expense.amount / 100).toFixed(2) : "",
    vendor: expense?.vendor ?? "",
    method: expense?.method ?? "Cash",
    note: expense?.note ?? "",
  });
  const createMutation = trpc.expenses.create.useMutation();
  const updateMutation = trpc.expenses.update.useMutation();

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? "Edit expense" : "Record expense"}
      footer={
        <>
          <span />
          <Button
            onClick={async () => {
              const payload = { typeId: form.typeId, amount: Math.round(parseFloat(form.amount || "0") * 100), vendor: form.vendor, method: form.method as any, note: form.note };
              if (expense) await updateMutation.mutateAsync({ id: expense.id, patch: payload });
              else await createMutation.mutateAsync(payload);
              onSaved();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums" style={inputStyle} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Vendor">
          <input className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
        </Field>
        <Field label="Method">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as Expense["method"] })}>
            <option>Cash</option>
            <option>Card</option>
            <option>Bank transfer</option>
            <option>Direct debit</option>
          </select>
        </Field>
        <Field label="Note">
          <input className="w-full px-3 py-2 text-[14px] border outline-none col-span-2" style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function ExpenseTypeManager({ onClose }: { onClose: () => void }) {
  const typesQuery = trpc.expenseTypes.list.useQuery();
  const utils = trpc.useUtils();
  const createMutation = trpc.expenseTypes.create.useMutation();
  const deleteMutation = trpc.expenseTypes.delete.useMutation();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2a78d6");

  return (
    <Modal open onClose={onClose} title="Expense types" width={480}>
      <div className="flex flex-col gap-2 mb-4">
        {typesQuery.data?.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-[13px] py-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
            <span className="flex-1">{t.name}</span>
            <button
              style={{ color: "var(--crit)" }}
              onClick={async () => {
                const reassignTo = typesQuery.data?.find((o) => o.id !== t.id)?.id;
                if (!reassignTo) return alert("Add another type first so expenses can be reassigned.");
                if (!confirm(`Delete ${t.name}? Its expenses move to ${typesQuery.data?.find((o) => o.id === reassignTo)?.name}.`)) return;
                await deleteMutation.mutateAsync({ id: t.id, reassignToId: reassignTo });
                utils.expenseTypes.list.invalidate();
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 border" style={inputStyle} />
        <input className="flex-1 px-3 py-2 text-[14px] border outline-none" style={inputStyle} placeholder="New type name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          onClick={async () => {
            if (!name.trim()) return;
            await createMutation.mutateAsync({ name, color });
            utils.expenseTypes.list.invalidate();
            setName("");
          }}
        >
          Add
        </Button>
      </div>
    </Modal>
  );
}
