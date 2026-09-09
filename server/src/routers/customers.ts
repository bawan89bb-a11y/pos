import { z } from "zod";
import { router, permProcedure } from "../trpc";
import * as customers from "../db/customers";

const customerGroup = z.enum(["All customers", "Wholesale", "Staff", "VIP"]);

export const customersRouter = router({
  list: permProcedure("customers", "view")
    .input(
      z
        .object({
          search: z.string().optional(),
          group: customerGroup.optional(),
          account: z.enum(["any", "owes", "credit", "settled"]).optional(),
        })
        .optional()
    )
    .query(({ input }) => customers.listCustomers(input ?? {})),

  get: permProcedure("customers", "view").input(z.string()).query(({ input }) => customers.getCustomer(input)),

  stats: permProcedure("customers", "view").input(z.string()).query(({ input }) => customers.customerStats(input)),

  create: permProcedure("customers", "create")
    .input(
      z.object({
        firstName: z.string().default(""),
        lastName: z.string().default(""),
        phone: z.string().default(""),
        email: z.string().default(""),
        group: customerGroup.default("All customers"),
        shipping: z.string().default(""),
        billing: z.string().default(""),
        notes: z.string().default(""),
      })
    )
    .mutation(({ input }) => customers.createCustomer(input)),

  update: permProcedure("customers", "edit")
    .input(
      z.object({
        id: z.string(),
        patch: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          group: customerGroup.optional(),
          shipping: z.string().optional(),
          billing: z.string().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(({ input }) => customers.updateCustomer(input.id, input.patch)),

  delete: permProcedure("customers", "delete").input(z.string()).mutation(({ input }) => customers.deleteCustomer(input)),

  payAccountBalance: permProcedure("customers", "edit")
    .input(z.object({ customerId: z.string(), amount: z.number().int().positive(), method: z.string() }))
    .mutation(({ ctx, input }) =>
      customers.payAccountBalance(input.customerId, input.amount, input.method, ctx.user!.id)
    ),

  import: permProcedure("customers", "create")
    .input(
      z.array(
        z.object({
          firstName: z.string().default(""),
          lastName: z.string().default(""),
          phone: z.string().default(""),
          email: z.string().default(""),
          group: customerGroup.default("All customers"),
          shipping: z.string().default(""),
          billing: z.string().default(""),
          notes: z.string().default(""),
          balance: z.number().default(0),
        })
      )
    )
    .mutation(async ({ input }) => {
      let created = 0;
      for (const row of input) {
        if (!row.firstName.trim() && !row.lastName.trim()) continue;
        await customers.createCustomer(row);
        created++;
      }
      return { created };
    }),
});
