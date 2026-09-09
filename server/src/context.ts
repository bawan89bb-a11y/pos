import type { Request, Response } from "express";
import { getSession } from "./db/auth";
import { getUserById } from "./db/users";
import type { UserRecord } from "@thoth/shared";

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "thoth_session";

export interface Context {
  req: Request;
  res: Response;
  sessionId: string | null;
  user: UserRecord | null;
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<Context> {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] ?? null;
  let user: UserRecord | null = null;

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session) {
      const u = await getUserById(session.userId);
      if (u && u.active) user = u;
    }
  }

  return { req, res, sessionId, user };
}
