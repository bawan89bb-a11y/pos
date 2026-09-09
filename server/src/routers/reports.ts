import { z } from "zod";
import { router, permProcedure } from "../trpc";
import * as reports from "../db/reports";

export const reportsRouter = router({
  summaryTiles: permProcedure("reports", "view")
    .input(z.object({ from: z.number(), to: z.number() }))
    .query(({ input }) => reports.summaryTiles(input.from, input.to)),

  netSalesByBucket: permProcedure("reports", "view")
    .input(z.object({ from: z.number(), to: z.number() }))
    .query(({ input }) => reports.netSalesByBucket(input.from, input.to)),

  paymentMix: permProcedure("reports", "view")
    .input(z.object({ from: z.number(), to: z.number() }))
    .query(({ input }) => reports.paymentMix(input.from, input.to)),

  expensesByType: permProcedure("reports", "view")
    .input(z.object({ from: z.number(), to: z.number() }))
    .query(({ input }) => reports.expensesByType(input.from, input.to)),

  topProducts: permProcedure("reports", "view")
    .input(z.object({ from: z.number(), to: z.number(), limit: z.number().optional() }))
    .query(({ input }) => reports.topProductsByRevenue(input.from, input.to, input.limit)),

  cashiersRanking: permProcedure("reports", "view")
    .input(z.object({ from: z.number(), to: z.number() }))
    .query(({ input }) => reports.cashiersRanking(input.from, input.to)),
});
