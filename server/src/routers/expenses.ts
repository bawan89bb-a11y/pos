import { z } from "zod";
import { router, permProcedure } from "../trpc";
import * as expenses from "../db/expenses";

const methodEnum = z.enum(["Cash", "Card", "Bank transfer", "Direct debit"]);

export const expensesRouter = router({
  list: permProcedure("expenses", "view")
    .input(
      z
        .object({
          from: z.number().optional(),
          to: z.number().optional(),
          typeId: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => expenses.listExpenses(input ?? {})),

  create: permProcedure("expenses", "create")
    .input(
      z.object({
        ts: z.number().default(() => Date.now()),
        typeId: z.string(),
        amount: z.number().int().positive(),
        vendor: z.string().default(""),
        method: methodEnum.default("Cash"),
        note: z.string().default(""),
      })
    )
    .mutation(({ input }) => expenses.createExpense(input)),

  update: permProcedure("expenses", "edit")
    .input(
      z.object({
        id: z.string(),
        patch: z.object({
          ts: z.number().optional(),
          typeId: z.string().optional(),
          amount: z.number().int().positive().optional(),
          vendor: z.string().optional(),
          method: methodEnum.optional(),
          note: z.string().optional(),
        }),
      })
    )
    .mutation(({ input }) => expenses.updateExpense(input.id, input.patch)),

  renew: permProcedure("expenses", "renew").input(z.string()).mutation(({ input }) => expenses.renewExpense(input)),
});

export const expenseTypesRouter = router({
  list: permProcedure("expenses", "view").query(() => expenses.listExpenseTypes()),
  create: permProcedure("expenses", "create")
    .input(z.object({ name: z.string().min(1), note: z.string().optional(), color: z.string() }))
    .mutation(({ input }) => expenses.createExpenseType(input)),
  update: permProcedure("expenses", "edit")
    .input(z.object({ id: z.string(), patch: z.object({ name: z.string().optional(), note: z.string().optional(), color: z.string().optional() }) }))
    .mutation(({ input }) => expenses.updateExpenseType(input.id, input.patch)),
  delete: permProcedure("expenses", "delete")
    .input(z.object({ id: z.string(), reassignToId: z.string() }))
    .mutation(({ input }) => expenses.deleteExpenseType(input.id, input.reassignToId)),
});
