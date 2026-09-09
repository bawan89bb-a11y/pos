import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import { can, type PageId, type ActionId } from "@thoth/shared";

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

const requireAuth = middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Any signed-in user. Every mutating handler still re-checks its own specific permission. */
export const protectedProcedure = t.procedure.use(requireAuth);

/** Requires a specific page/action permission on the signed-in user, re-checked server-side on every call. */
export function permProcedure(page: PageId, action: ActionId) {
  return t.procedure.use(requireAuth).use(
    middleware(({ ctx, next }) => {
      if (!can(ctx.user!.perms, page, action)) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Missing ${page}.${action} permission` });
      }
      return next();
    })
  );
}
