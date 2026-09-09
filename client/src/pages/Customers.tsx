import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/Shell";
import { trpc } from "../trpc";
import { useAuth } from "../lib/auth";
import { useFormatMoney } from "../lib/settings";
import { can, parseCsvToObjects, toCsv, formatDateTime } from "@thoth/shared";
import type { Customer, CustomerGroup } from "@thoth/shared";
import { Button, EmptyState, Field, inputStyle, Modal } from "../components/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CustomerCard } from "../components/CustomerCard";

const GROUPS: CustomerGroup[] = ["All customers", "Wholesale", "Staff", "VIP"];

export default function Customers() {
  const { user } = useAuth();
  const fmt = useFormatMoney();
  const navigate = useNavigate();
  const [staged, setStaged] = useState({ search: "", group: "" as CustomerGroup | "", account: "any" as "any" | "owes" | "credit" | "settled" });
  const [applied, setApplied] = useState(staged);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [payDialogFor, setPayDialogFor] = useState<Customer | null>(null);

  const customersQuery = trpc.customers.list.useQuery({
    search: applied.search || undefined,
    group: applied.group || undefined,
    account: applied.account,
  });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.customers.delete.useMutation();

  function exportCsv() {
    const rows = (customersQuery.data ?? []).map((c) => [c.firstName, c.lastName, c.phone, c.email, c.group, (c.balance / 100).toFixed(2)]);
    const csv = toCsv(["First name", "Last name", "Phone", "Email", "Group", "Balance"], rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "customers.csv";
    a.click();
  }

  return (
    <AppShell title="Customers">
      <div className="p-[18px] flex flex-col gap-4">
        <div className="rounded-[10px] p-3 flex items-center justify-between" style={{ background: "var(--surface-3)" }}>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Manage customers and their account balances, or organize them by group and spending habits.{" "}
            <a href="#" className="underline" style={{ color: "var(--brand)" }}>
              Need help?
            </a>
          </p>
          <div className="flex gap-2">
            {can(user?.perms, "customers", "create") && (
              <>
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  Import customers
                </Button>
                <Button onClick={() => setAddOpen(true)}>Add customer</Button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-[10px] p-4 grid grid-cols-4 gap-3" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <Field label="Search">
            <input
              className="w-full px-3 py-2 text-[14px] border outline-none"
              style={inputStyle}
              value={staged.search}
              onChange={(e) => setStaged({ ...staged, search: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && setApplied(staged)}
            />
          </Field>
          <Field label="Customer group">
            <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={staged.group} onChange={(e) => setStaged({ ...staged, group: e.target.value as any })}>
              <option value="">All groups</option>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account">
            <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={staged.account} onChange={(e) => setStaged({ ...staged, account: e.target.value as any })}>
              <option value="any">Any</option>
              <option value="owes">Owes money</option>
              <option value="credit">In credit</option>
              <option value="settled">Settled</option>
            </select>
          </Field>
          <div className="flex gap-2 items-end">
            <Button onClick={() => setApplied(staged)}>Search</Button>
            <Button
              variant="secondary"
              onClick={() => {
                const cleared = { search: "", group: "" as const, account: "any" as const };
                setStaged(cleared);
                setApplied(cleared);
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="flex justify-between items-center text-[13px]" style={{ color: "var(--ink-3)" }}>
          <span>Showing {customersQuery.data?.length ?? 0} customers</span>
          {can(user?.perms, "customers", "export") && (
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
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Location</th>
                <th className="px-3 py-2.5 text-right">Visits</th>
                <th className="px-3 py-2.5 text-right">Total spend</th>
                <th className="px-3 py-2.5 text-right">Account</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {customersQuery.data?.map((c) => (
                <CustomerRow
                  key={c.id}
                  customer={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  fmt={fmt}
                  onEdit={() => setEditingId(c.id)}
                  onPay={() => setPayDialogFor(c)}
                  onDelete={async () => {
                    if (!confirm(`Delete ${c.name}? Past sales stay in history but lose the customer link.`)) return;
                    await deleteMutation.mutateAsync(c.id);
                    utils.customers.list.invalidate();
                  }}
                  onViewSales={() => navigate(`/sales?customer=${c.id}`)}
                />
              ))}
            </tbody>
          </table>
          {!customersQuery.data?.length && <EmptyState text="No customers match these filters yet." />}
        </div>
      </div>

      {(addOpen || editingId) && (
        <CustomerCard
          customerId={editingId}
          onClose={() => {
            setAddOpen(false);
            setEditingId(undefined);
          }}
          onSelect={() => {
            setAddOpen(false);
            setEditingId(undefined);
            utils.customers.list.invalidate();
          }}
        />
      )}
      {payDialogFor && (
        <PayBalanceDialog
          customer={payDialogFor}
          onClose={() => setPayDialogFor(null)}
          onDone={() => {
            setPayDialogFor(null);
            utils.customers.list.invalidate();
          }}
        />
      )}
      {importOpen && <CustomerImportDialog onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); utils.customers.list.invalidate(); }} />}
    </AppShell>
  );
}

function CustomerRow({
  customer,
  expanded,
  onToggle,
  fmt,
  onEdit,
  onPay,
  onDelete,
  onViewSales,
}: {
  customer: Customer;
  expanded: boolean;
  onToggle: () => void;
  fmt: (c: number) => string;
  onEdit: () => void;
  onPay: () => void;
  onDelete: () => void;
  onViewSales: () => void;
}) {
  const { user } = useAuth();
  const statsQuery = trpc.customers.stats.useQuery(customer.id, { enabled: expanded });
  const [tab, setTab] = useState<"details" | "account" | "notes">("details");

  return (
    <>
      <tr className="border-t cursor-pointer" style={{ borderColor: "var(--line)" }} onClick={onToggle}>
        <td className="px-3">{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>
              {customer.firstName[0]}
              {customer.lastName[0]}
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate flex items-center gap-1.5">
                {customer.name}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}>
                  {customer.group}
                </span>
              </div>
              <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                {customer.code} | {customer.phone}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5" style={{ color: "var(--ink-3)" }}>
          —
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{expanded ? statsQuery.data?.visits ?? "…" : ""}</td>
        <td className="px-3 py-2.5 text-right tabular-nums">{expanded ? (statsQuery.data ? fmt(statsQuery.data.spend) : "…") : ""}</td>
        <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: customer.balance < 0 ? "var(--crit)" : "var(--ink)" }}>
          {fmt(customer.balance)}
        </td>
        <td className="px-3 py-2.5">
          {can(user?.perms, "customers", "edit") && (
            <button
              style={{ color: "var(--ink-3)" }}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              Edit
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
          <td colSpan={7} className="p-0">
            <div className="flex">
              <div className="flex-1 p-4">
                <div className="flex gap-4 mb-3 border-b text-[13px]" style={{ borderColor: "var(--line)" }}>
                  {(["details", "account", "notes"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className="pb-2 capitalize font-medium"
                      style={{ color: tab === t ? "var(--brand)" : "var(--ink-3)", borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent" }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {tab === "details" && (
                  <div className="text-[13px] flex flex-col gap-1.5">
                    <div>
                      <span style={{ color: "var(--ink-3)" }}>Code: </span>
                      {customer.code}
                    </div>
                    <div>
                      <span style={{ color: "var(--ink-3)" }}>Mobile: </span>
                      <a href={`tel:${customer.phone}`} style={{ color: "var(--brand)" }}>
                        {customer.phone}
                      </a>
                    </div>
                    <div>
                      <span style={{ color: "var(--ink-3)" }}>Email: </span>
                      <a href={`mailto:${customer.email}`} style={{ color: "var(--brand)" }}>
                        {customer.email}
                      </a>
                    </div>
                  </div>
                )}
                {tab === "account" && (
                  <div className="text-[13px] flex flex-col gap-1.5">
                    <div>Balance: {fmt(customer.balance)}</div>
                    {customer.accountPayments.map((p, i) => (
                      <div key={i} className="flex justify-between max-w-xs">
                        <span style={{ color: "var(--ink-3)" }}>{formatDateTime(p.ts)}</span>
                        <span className="tabular-nums">{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {tab === "notes" && <p className="text-[13px]">{customer.notes || "No notes."}</p>}
              </div>
              <div className="w-[230px] p-4 flex flex-col gap-2 text-[13px] border-l" style={{ borderColor: "var(--line)" }}>
                {can(user?.perms, "customers", "edit") && (
                  <button className="text-left" style={{ color: "var(--brand)" }} onClick={onEdit}>
                    Edit customer
                  </button>
                )}
                <button className="text-left" style={{ color: "var(--brand)" }} onClick={onViewSales}>
                  View sales
                </button>
                {customer.balance < 0 && (
                  <button className="text-left" style={{ color: "var(--brand)" }} onClick={onPay}>
                    Pay account balance
                  </button>
                )}
                {can(user?.perms, "customers", "delete") && (
                  <button className="text-left" style={{ color: "var(--crit)" }} onClick={onDelete}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PayBalanceDialog({ customer, onClose, onDone }: { customer: Customer; onClose: () => void; onDone: () => void }) {
  const owed = Math.abs(Math.min(0, customer.balance));
  const [amountStr, setAmountStr] = useState((owed / 100).toFixed(2));
  const [method, setMethod] = useState("cash");
  const payMutation = trpc.customers.payAccountBalance.useMutation();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pay account balance · ${customer.name}`}
      footer={
        <>
          <span />
          <Button
            onClick={async () => {
              await payMutation.mutateAsync({ customerId: customer.id, amount: Math.round(parseFloat(amountStr || "0") * 100), method });
              onDone();
            }}
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Amount">
          <input className="w-full px-3 py-2 text-[14px] border outline-none tabular-nums" style={inputStyle} value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
        </Field>
        <Field label="Method">
          <select className="w-full px-3 py-2 text-[14px] border outline-none" style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank transfer">Bank transfer</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function CustomerImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [result, setResult] = useState<{ created: number } | null>(null);
  const importMutation = trpc.customers.import.useMutation();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRows(parseCsvToObjects(String(reader.result)));
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = toCsv(
      ["First name", "Last name", "Mobile", "Email", "Group", "Shipping", "Billing", "Notes", "Balance"],
      [["Jane", "Doe", "0770000000", "jane@example.com", "All customers", "", "", "", "0"]]
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "customers-template.csv";
    a.click();
  }

  async function doImport() {
    if (!rows) return;
    const payload = rows.map((r) => ({
      firstName: r["First name"] ?? "",
      lastName: r["Last name"] ?? "",
      phone: r["Mobile"] ?? "",
      email: r["Email"] ?? "",
      group: (r["Group"] as CustomerGroup) || "All customers",
      shipping: r["Shipping"] ?? "",
      billing: r["Billing"] ?? "",
      notes: r["Notes"] ?? "",
      balance: Math.round(parseFloat(r["Balance"] || "0") * 100),
    }));
    setResult(await importMutation.mutateAsync(payload));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import customers"
      footer={
        result ? (
          <>
            <span />
            <Button onClick={onDone}>Done</Button>
          </>
        ) : (
          <>
            <button className="text-[13px]" style={{ color: "var(--brand)" }} onClick={downloadTemplate}>
              Download template
            </button>
            <Button disabled={!rows?.length} onClick={doImport}>
              Import {rows?.length ?? 0} rows
            </Button>
          </>
        )
      }
    >
      {result ? (
        <p className="text-[14px]">Imported {result.created} customers.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            CSV header: First name, Last name, Mobile, Email, Group, Shipping, Billing, Notes, Balance.
          </p>
          <input type="file" accept=".csv" onChange={onFile} />
          {rows && (
            <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
              {rows.length} rows ready to import.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
