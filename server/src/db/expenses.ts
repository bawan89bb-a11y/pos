import { and, desc, eq, gte, lt, like } from "drizzle-orm";
import { db, schema } from "./client";
import { newId } from "./ids";
import type { Expense, ExpenseType } from "@thoth/shared";

export async function listExpenseTypes(): Promise<ExpenseType[]> {
  return db.select().from(schema.expenseTypes).orderBy(schema.expenseTypes.name);
}

export async function createExpenseType(input: { name: string; note?: string; color: string }): Promise<ExpenseType> {
  const id = newId("ety");
  await db.insert(schema.expenseTypes).values({ id, name: input.name, note: input.note ?? "", color: input.color });
  const [row] = await db.select().from(schema.expenseTypes).where(eq(schema.expenseTypes.id, id));
  return row;
}

export async function updateExpenseType(id: string, patch: Partial<ExpenseType>): Promise<ExpenseType> {
  await db.update(schema.expenseTypes).set(patch).where(eq(schema.expenseTypes.id, id));
  const [row] = await db.select().from(schema.expenseTypes).where(eq(schema.expenseTypes.id, id));
  return row;
}

export async function deleteExpenseType(id: string, reassignToId: string): Promise<void> {
  await db.update(schema.expenses).set({ typeId: reassignToId }).where(eq(schema.expenses.typeId, id));
  await db.delete(schema.expenseTypes).where(eq(schema.expenseTypes.id, id));
}

export interface ExpenseFilters {
  from?: number;
  to?: number;
  typeId?: string;
  search?: string;
}

export async function listExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  const clauses = [];
  if (filters.from !== undefined) clauses.push(gte(schema.expenses.ts, filters.from));
  if (filters.to !== undefined) clauses.push(lt(schema.expenses.ts, filters.to));
  if (filters.typeId) clauses.push(eq(schema.expenses.typeId, filters.typeId));
  if (filters.search) clauses.push(like(schema.expenses.vendor, `%${filters.search}%`));

  return db
    .select()
    .from(schema.expenses)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(schema.expenses.ts));
}

export async function createExpense(
  input: Omit<Expense, "id">
): Promise<Expense> {
  const id = newId("exp");
  await db.insert(schema.expenses).values({ id, ...input });
  const [row] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
  return row;
}

export async function updateExpense(id: string, patch: Partial<Expense>): Promise<Expense> {
  await db.update(schema.expenses).set(patch as any).where(eq(schema.expenses.id, id));
  const [row] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
  return row;
}

export async function renewExpense(id: string): Promise<Expense> {
  const [row] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id));
  if (!row) throw new Error("Expense not found");
  return createExpense({
    ts: Date.now(),
    typeId: row.typeId,
    amount: row.amount,
    vendor: row.vendor,
    method: row.method,
    note: row.note,
  });
}
