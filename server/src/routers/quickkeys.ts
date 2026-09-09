import { z } from "zod";
import { router, permProcedure } from "../trpc";
import * as qk from "../db/quickkeys";

const quickKeyNode: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      type: z.enum(["product", "folder"]),
      label: z.string(),
      color: z.string(),
      productId: z.string().optional(),
      keys: z.array(quickKeyNode.nullable()).optional(),
    })
    .nullable()
);

const pageSchema = z.object({
  id: z.string(),
  name: z.string(),
  keys: z.array(quickKeyNode),
});

export const quickKeysRouter = router({
  list: permProcedure("settings", "view").query(() => qk.listLayouts()),
  get: permProcedure("settings", "view").input(z.string()).query(({ input }) => qk.getLayout(input)),
  create: permProcedure("settings", "create")
    .input(z.object({ name: z.string().min(1) }))
    .mutation(({ input }) => qk.createLayout(input.name)),
  copy: permProcedure("settings", "create").input(z.string()).mutation(({ input }) => qk.copyLayout(input)),
  update: permProcedure("settings", "edit")
    .input(z.object({ id: z.string(), name: z.string().optional(), pages: z.array(pageSchema).optional() }))
    .mutation(({ input }) => qk.updateLayout(input.id, { name: input.name, pages: input.pages })),
  delete: permProcedure("settings", "delete").input(z.string()).mutation(({ input }) => qk.deleteLayout(input)),
});
