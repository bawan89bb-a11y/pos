import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { SESSION_COOKIE_NAME } from "../context";
import { getUserByUsername, getUserById } from "../db/users";
import { verifyPassword, createSession, deleteSession } from "../db/auth";
import { migratePerms, type Perms } from "@thoth/shared";

const isProd = process.env.NODE_ENV === "production";

function setSessionCookie(res: any, sessionId: string, expiresAt: number) {
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

function toClientUser(row: { id: string; name: string; username: string; email: string; role: string; active: boolean; perms: unknown; createdAt: number }) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    role: row.role,
    active: row.active,
    perms: migratePerms(row.perms as Partial<Perms>),
    createdAt: row.createdAt,
  };
}

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await getUserByUsername(input.username);
      // one generic error for both wrong password and unknown username
      if (!row) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect username or password" });

      const validPassword = await verifyPassword(input.password, row.passHash);
      if (!validPassword) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect username or password" });

      if (!row.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This account has been disabled" });
      }

      const session = await createSession(row.id);
      setSessionCookie(ctx.res, session.id, session.expiresAt);
      return toClientUser(row);
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionId) await deleteSession(ctx.sessionId);
    ctx.res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  }),

  me: publicProcedure.query(({ ctx }) => ctx.user),

  /** Switch user: verifies the target user's own password, does not reuse the current session's identity. */
  switchUser: publicProcedure
    .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await getUserByUsername(input.username);
      if (!row) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect username or password" });
      const validPassword = await verifyPassword(input.password, row.passHash);
      if (!validPassword) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect username or password" });
      if (!row.active) throw new TRPCError({ code: "FORBIDDEN", message: "This account has been disabled" });

      if (ctx.sessionId) await deleteSession(ctx.sessionId);
      const session = await createSession(row.id);
      setSessionCookie(ctx.res, session.id, session.expiresAt);
      return toClientUser(row);
    }),
});
