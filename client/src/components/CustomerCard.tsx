import { useState } from "react";
import { trpc } from "../trpc";
import { Modal, Button, Field, inputStyle } from "./ui";
import { useFormatMoney } from "../lib/settings";
import { formatDateTime } from "@thoth/shared";
import type { Customer, CustomerGroup } from "@thoth/shared";

const GROUPS: CustomerGroup[] = ["All customers", "Wholesale", "Staff", "VIP"];

export function CustomerCard({
  customerId,
  prefillPhoneOrName,
  onClose,
  onSelect,
}: {
  customerId?: string;
  prefillPhoneOrName?: string;
  onClose: () => void;
  onSelect?: (c: Customer) => void;
}) {
  const isNumeric = !!prefillPhoneOrName && /\d/.test(prefillPhoneOrName) && !/[a-zA-Z]/.test(prefillPhoneOrName);
  const [tab, setTab] = useState<"details" | "account" | "notes">("details");
  const customerQuery = trpc.customers.get.useQuery(customerId!, { enabled: !!customerId });
  const statsQuery = trpc.customers.stats.useQuery(customerId!, { enabled: !!customerId });
  const fmt = useFormatMoney();
  const createMutation = trpc.customers.create.useMutation();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    firstName: isNumeric ? "" : prefillPhoneOrName ?? "",
    lastName: "",
    phone: isNumeric ? prefillPhoneOrName ?? "" : "",
    email: "",
    group: "All customers" as CustomerGroup,
  });

  if (!customerId) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Add new customer"
        footer={
          <>
            <span />
            <Button
              onClick={async () => {
                const c = await createMutation.mutateAsync(form);
                utils.customers.list.invalidate();
                onSelect?.(c);
              }}
            >
              Save customer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className="w-full px-3 py-2 text-[14px] border outline-none"
              style={inputStyle}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </Field>
          <Field label="Last name">
            <input
              className="w-full px-3 py-2 text-[14px] border outline-none"
              style={inputStyle}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </Field>
          <Field label="Mobile">
            <input
              className="w-full px-3 py-2 text-[14px] border outline-none"
              style={inputStyle}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              className="w-full px-3 py-2 text-[14px] border outline-none"
              style={inputStyle}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Group">
            <select
              className="w-full px-3 py-2 text-[14px] border outline-none"
              style={inputStyle}
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value as CustomerGroup })}
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>
    );
  }

  const c = customerQuery.data;
  if (!c) return null;

  return (
    <Modal open onClose={onClose} title={c.name} width={420}>
      <div className="flex flex-col items-center text-center mb-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-[16px] font-semibold mb-2"
          style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
        >
          {c.firstName[0]}
          {c.lastName[0]}
        </div>
        <div className="font-semibold text-[15px]" style={{ color: "var(--ink)" }}>
          {c.name}
        </div>
        <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
          {c.group}
        </div>
        <div
          className="mt-2 text-[18px] font-semibold tabular-nums"
          style={{ color: c.balance < 0 ? "var(--crit)" : "var(--ink)" }}
        >
          {fmt(c.balance)}
        </div>
        <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
          Account balance
        </div>
      </div>

      <div className="flex gap-4 mb-3 border-b text-[13px]" style={{ borderColor: "var(--line)" }}>
        {(["details", "account", "notes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="pb-2 capitalize font-medium"
            style={{
              color: tab === t ? "var(--brand)" : "var(--ink-3)",
              borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="flex flex-col gap-2 text-[13px]">
          <Row label="Code" value={c.code} />
          <Row label="Mobile" value={c.phone} href={`tel:${c.phone}`} />
          <Row label="Email" value={c.email} href={`mailto:${c.email}`} />
          <Row label="Shipping" value={c.shipping || "—"} />
          <Row label="Billing" value={c.billing || "—"} />
        </div>
      )}
      {tab === "account" && (
        <div className="flex flex-col gap-2 text-[13px]">
          <Row label="Visits" value={String(statsQuery.data?.visits ?? 0)} />
          <Row label="Total spend" value={fmt(statsQuery.data?.spend ?? 0)} />
          <div className="mt-2 flex flex-col divide-y" style={{ borderColor: "var(--line)" }}>
            {c.accountPayments.map((p, i) => (
              <div key={i} className="flex justify-between py-1.5">
                <span style={{ color: "var(--ink-3)" }}>{formatDateTime(p.ts)}</span>
                <span className="tabular-nums">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "notes" && (
        <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
          {c.notes || "No notes."}
        </p>
      )}

      <div className="flex gap-3 mt-4 pt-3 border-t text-[13px] font-medium" style={{ borderColor: "var(--line)", color: "var(--brand)" }}>
        <button onClick={() => onSelect?.(c)}>Use for this sale</button>
      </div>
    </Modal>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: "var(--ink-3)" }}>{label}</span>
      {href ? (
        <a href={href} className="hover:underline" style={{ color: "var(--brand)" }}>
          {value}
        </a>
      ) : (
        <span style={{ color: "var(--ink)" }}>{value}</span>
      )}
    </div>
  );
}
