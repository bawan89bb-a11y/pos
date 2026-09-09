import { z } from "zod";
import { router, permProcedure } from "../trpc";
import * as dashboardDb from "../db/dashboard";
import * as settingsDb from "../db/settings";

export const dashboardRouter = router({
  needsAttention: permProcedure("dashboard", "view")
    .input(z.object({ now: z.number() }))
    .query(async ({ input }) => {
      const settings = await settingsDb.getSettings();
      return dashboardDb.needsAttention(input.now, settings.expiryWarnMonths, settings.expiryUrgentMonths);
    }),
});

export const alertsRouter = router({
  expiry: permProcedure("dashboard", "view")
    .input(z.object({ now: z.number() }))
    .query(async ({ input }) => {
      const settings = await settingsDb.getSettings();
      return dashboardDb.expiryAlerts(input.now, settings.expiryWarnMonths, settings.expiryUrgentMonths);
    }),
});
