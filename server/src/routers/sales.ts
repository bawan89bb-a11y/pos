import { z } from "zod";
import { router, permProcedure } from "../trpc";
import * as sales from "../db/sales";

const paymentInput = z.object({
  method: z.enum(["cash", "card", "gift"]),
  amount: z.number().int().positive(),
  ref: z.string().optional(),
});

export const salesRouter = router({
  list: permProcedure("sales", "view")
    .input(
      z
        .object({
          from: z.number().optional(),
          to: z.number().optional(),
          customerId: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(({ input }) => sales.listSales(input ?? {})),

  get: permProcedure("sales", "view").input(z.string()).query(({ input }) => sales.getSale(input)),

  create: permProcedure("register", "create")
    .input(
      z.object({
        customerId: z.string().nullable().optional(),
        lines: z.array(
          z.object({
            productId: z.string(),
            qty: z.number().int().positive(),
            discountPct: z.number().min(0).max(100).default(0),
          })
        ),
        discountPct: z.number().min(0).max(100).default(0),
        note: z.string().default(""),
        payments: z.array(paymentInput).default([]),
        putOnAccount: z.boolean().default(false),
      })
    )
    .mutation(({ ctx, input }) => sales.createSale({ ...input, userId: ctx.user!.id })),

  refund: permProcedure("sales", "edit")
    .input(
      z.object({
        saleId: z.string(),
        amount: z.number().int().positive(),
        reason: z.string(),
        restock: z.boolean(),
        restockLines: z.array(z.object({ productId: z.string(), qty: z.number().int().positive() })).optional(),
      })
    )
    .mutation(({ input }) => sales.refundSale(input)),

  void: permProcedure("sales", "delete")
    .input(z.object({ saleId: z.string(), reason: z.string().min(1) }))
    .mutation(({ input }) => sales.voidSale(input.saleId, input.reason)),

  payOnAccountBalance: permProcedure("sales", "edit")
    .input(z.object({ saleId: z.string(), amount: z.number().int().positive() }))
    .mutation(({ input }) => sales.payOnAccountBalance(input.saleId, input.amount)),

  updateNote: permProcedure("sales", "edit")
    .input(z.object({ saleId: z.string(), note: z.string() }))
    .mutation(({ input }) => sales.updateSaleNote(input.saleId, input.note)),

  park: permProcedure("register", "create")
    .input(
      z.object({
        lines: z.array(
          z.object({
            productId: z.string(),
            name: z.string(),
            sku: z.string(),
            unitPrice: z.number().int(),
            qty: z.number().int().positive(),
            discountPct: z.number().min(0).max(100),
            taxable: z.boolean(),
          })
        ),
        customerId: z.string().nullable(),
        discountPct: z.number().min(0).max(100),
        note: z.string(),
      })
    )
    .mutation(({ ctx, input }) => sales.parkCart({ ...input, userId: ctx.user!.id })),

  listParked: permProcedure("register", "view").query(() => sales.listParkedCarts()),

  retrieveParked: permProcedure("register", "view").input(z.string()).mutation(({ input }) => sales.retrieveCart(input)),
});
