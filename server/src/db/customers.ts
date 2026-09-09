import { and, eq, like, or, desc, sql } from "drizzle-orm";
import { db, schema } from "./client";
import { newId, newCustomerCode } from "./ids";
import { rows } from "./sql";
import { normalizePhoneDigits } from "@thoth/shared";
import type { Customer, CustomerGroup, AccountPayment } from "@thoth/shared";

function rowToCustomer(
  row: typeof schema.customers.$inferSelect,
  payments: typeof schema.accountPayments.$inferSelect[] = []
): Customer {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    name: row.name,
    code: row.code,
    phone: row.phone,
    email: row.email,
    group: row.group,
    shipping: row.shipping,
    billing: row.billing,
    notes: row.notes,
    balance: row.balance,
    accountPayments: payments.map((p) => ({
      ts: p.ts,
      amount: p.amount,
      method: p.method,
      userId: p.userId,
    })),
    createdAt: row.createdAt,
  };
}

export interface CustomerFilters {
  search?: string;
  group?: CustomerGroup;
  account?: "any" | "owes" | "credit" | "settled";
}

export async function listCustomers(filters: CustomerFilters = {}): Promise<Customer[]> {
  const clauses = [];
  if (filters.group) clauses.push(eq(schema.customers.group, filters.group));
  if (filters.account === "owes") clauses.push(sql`${schema.customers.balance} < 0`);
  else if (filters.account === "credit") clauses.push(sql`${schema.customers.balance} > 0`);
  else if (filters.account === "settled") clauses.push(sql`${schema.customers.balance} = 0`);

  let rows = await db
    .select()
    .from(schema.customers)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(schema.customers.createdAt));

  if (filters.search) {
    const s = filters.search.toLowerCase();
    const digits = normalizePhoneDigits(filters.search);
    rows = rows.filter((r) => {
      if (r.name.toLowerCase().includes(s)) return true;
      if (r.code.toLowerCase().includes(s)) return true;
      if (r.email.toLowerCase().includes(s)) return true;
      if (digits && normalizePhoneDigits(r.phone).includes(digits)) return true;
      return false;
    });
  }

  return rows.map((r) => rowToCustomer(r));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const [row] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
  if (!row) return null;
  const payments = await db
    .select()
    .from(schema.accountPayments)
    .where(eq(schema.accountPayments.customerId, id))
    .orderBy(desc(schema.accountPayments.ts));
  return rowToCustomer(row, payments);
}

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  group: CustomerGroup;
  shipping?: string;
  billing?: string;
  notes?: string;
  balance?: number;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const id = newId("cus");
  const name = `${input.firstName} ${input.lastName}`.trim();
  const code = newCustomerCode(input.firstName);
  await db.insert(schema.customers).values({
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    name,
    code,
    phone: input.phone,
    email: input.email,
    group: input.group,
    shipping: input.shipping ?? "",
    billing: input.billing ?? "",
    notes: input.notes ?? "",
    balance: input.balance ?? 0,
    createdAt: Date.now(),
  });
  return (await getCustomer(id))!;
}

export async function updateCustomer(
  id: string,
  patch: Partial<CreateCustomerInput>
): Promise<Customer> {
  const update: Partial<typeof schema.customers.$inferInsert> = { ...patch } as any;
  if (patch.firstName !== undefined || patch.lastName !== undefined) {
    const existing = await getCustomer(id);
    const firstName = patch.firstName ?? existing?.firstName ?? "";
    const lastName = patch.lastName ?? existing?.lastName ?? "";
    update.name = `${firstName} ${lastName}`.trim();
  }
  await db.update(schema.customers).set(update).where(eq(schema.customers.id, id));
  return (await getCustomer(id))!;
}

export async function deleteCustomer(id: string): Promise<void> {
  await db.delete(schema.customers).where(eq(schema.customers.id, id));
}

/** amount is a positive cents value paid toward the balance (balance moves toward zero). */
export async function payAccountBalance(
  customerId: string,
  amount: number,
  method: string,
  userId: string
): Promise<Customer> {
  const paymentId = newId("apy");
  await db.insert(schema.accountPayments).values({
    id: paymentId,
    customerId,
    ts: Date.now(),
    amount,
    method,
    userId,
  });
  await db
    .update(schema.customers)
    .set({ balance: sql`${schema.customers.balance} + ${amount}` })
    .where(eq(schema.customers.id, customerId));
  return (await getCustomer(customerId))!;
}

export async function customerStats(customerId: string) {
  const [{ visits, spend }] = await rows<{ visits: number; spend: number }>(sql`
    SELECT COUNT(*) as visits, COALESCE(SUM(total),0) as spend
    FROM sales
    WHERE customer_id = ${customerId} AND status <> 'void'
  `);
  return { visits: Number(visits), spend: Number(spend) };
}
