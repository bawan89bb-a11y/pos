import { z } from "zod";
import { router, permProcedure, publicProcedure } from "../trpc";
import * as settingsDb from "../db/settings";

const settingsPatch = z.object({
  store: z.string().optional(),
  addr: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  logo: z.string().max(1_300_000, "Logo image is too large").optional(), // ~900KB base64
  currency: z.string().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  receiptFooter: z.string().optional(),
  invoiceTitle: z.string().optional(),
  showLogoOnInvoice: z.boolean().optional(),
  docFormat: z.enum(["receipt", "a4"]).optional(),
  quickKeys: z.boolean().optional(),
  activeLayoutId: z.string().optional(),
  expiryWarnMonths: z.number().int().optional(),
  expiryUrgentMonths: z.number().int().optional(),
});

export const settingsRouter = router({
  // publicly readable so the login screen can show the business name/logo
  get: publicProcedure.query(() => settingsDb.getSettings()),
  update: permProcedure("settings", "edit").input(settingsPatch).mutation(({ input }) => settingsDb.updateSettings(input)),
});
