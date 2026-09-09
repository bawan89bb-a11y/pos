import bcrypt from "bcryptjs";
import { eq, lt } from "drizzle-orm";
import { db, schema } from "./client";
import { newId } from "./ids";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h; the client never persists it across reload anyway

export async function hashPassword(plain: string): Promise<{ hash: string; salt: string }> {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plain, salt);
  return { hash, salt };
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: number }> {
  const id = newId("sess");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await db.insert(schema.sessions).values({ id, userId, createdAt: now, expiresAt });
  return { id, expiresAt };
}

export async function getSession(sessionId: string) {
  const [row] = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, sessionId))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
    return null;
  }
  return row;
}

export async function deleteSession(sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function purgeExpiredSessions() {
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now()));
}
