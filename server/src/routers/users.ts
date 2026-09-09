import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, permProcedure, protectedProcedure } from "../trpc";
import * as usersDb from "../db/users";
import { ACTIONS, PAGES } from "@thoth/shared";

const permsSchema = z.record(z.enum(PAGES), z.record(z.enum(ACTIONS), z.boolean())) as unknown as z.ZodType<any>;

export const usersRouter = router({
  list: permProcedure("settings", "view").query(() => usersDb.listUsers()),

  /** Minimal {id, name} for every user — any signed-in staff member can see who rang up a sale. */
  names: protectedProcedure.query(async () => {
    const users = await usersDb.listUsers();
    return users.map((u) => ({ id: u.id, name: u.name }));
  }),

  create: permProcedure("settings", "create")
    .input(
      z.object({
        name: z.string().min(1),
        username: z
          .string()
          .min(3)
          .regex(/^\S+$/, "Username cannot contain spaces"),
        password: z.string().min(4),
        email: z.string().default(""),
        role: z.enum(["Owner", "Manager", "Cashier", "Custom"]),
        active: z.boolean().default(true),
        perms: permsSchema.optional(),
      })
    )
    .mutation(({ input }) => usersDb.createUser(input)),

  update: permProcedure("settings", "edit")
    .input(
      z.object({
        id: z.string(),
        patch: z.object({
          name: z.string().optional(),
          username: z
            .string()
            .min(3)
            .regex(/^\S+$/, "Username cannot contain spaces")
            .optional(),
          password: z.string().min(4).optional().or(z.literal("")),
          email: z.string().optional(),
          role: z.enum(["Owner", "Manager", "Cashier", "Custom"]).optional(),
          active: z.boolean().optional(),
          perms: permsSchema.optional(),
        }),
      })
    )
    .mutation(({ ctx, input }) => {
      if (input.id === ctx.user!.id && input.patch.active === false) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot deactivate your own account" });
      }
      return usersDb.updateUser(input.id, {
        ...input.patch,
        password: input.patch.password || undefined,
      });
    }),

  delete: permProcedure("settings", "delete")
    .input(z.string())
    .mutation(({ ctx, input }) => {
      if (input === ctx.user!.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
      }
      return usersDb.deleteUser(input);
    }),
});
