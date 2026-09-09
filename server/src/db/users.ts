import { eq, sql } from "drizzle-orm";
import { db, schema } from "./client";
import { newId } from "./ids";
import { hashPassword } from "./auth";
import { presetForRole, type Perms, type Role, migratePerms } from "@thoth/shared";
import type { UserRecord } from "@thoth/shared";

function rowToUser(row: typeof schema.users.$inferSelect): UserRecord {
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

export async function listUsers(): Promise<UserRecord[]> {
  const rows = await db.select().from(schema.users).orderBy(schema.users.createdAt);
  return rows.map(rowToUser);
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return row ? rowToUser(row) : null;
}

export async function getUserByUsername(username: string) {
  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function countActiveUsersWithSettingsEdit(excludeId?: string): Promise<number> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.active, true));
  return rows.filter((r) => {
    if (excludeId && r.id === excludeId) return false;
    const perms = migratePerms(r.perms as Partial<Perms>);
    return perms.settings.edit;
  }).length;
}

export interface CreateUserInput {
  name: string;
  username: string;
  password: string;
  email: string;
  role: Role;
  active: boolean;
  perms?: Perms;
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const existing = await getUserByUsername(input.username);
  if (existing) throw new Error("Username is already taken");

  const { hash, salt } = await hashPassword(input.password);
  const id = newId("usr");
  const perms = input.perms ?? presetForRole(input.role);
  await db.insert(schema.users).values({
    id,
    name: input.name,
    username: input.username.toLowerCase(),
    passHash: hash,
    passSalt: salt,
    email: input.email,
    role: input.role,
    active: input.active,
    perms,
    createdAt: Date.now(),
  });
  return (await getUserById(id))!;
}

export interface UpdateUserInput {
  name?: string;
  username?: string;
  password?: string; // blank/undefined keeps existing
  email?: string;
  role?: Role;
  active?: boolean;
  perms?: Perms;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserRecord> {
  const existing = await getUserById(id);
  if (!existing) throw new Error("User not found");

  if (!input.active && existing.active) {
    // deactivating: can't deactivate self is checked by the caller (needs current user id);
    // last active settings.edit holder guard:
    const otherCount = await countActiveUsersWithSettingsEdit(id);
    const willKeepAccess = input.perms ? input.perms.settings.edit : existing.perms.settings.edit;
    if (otherCount === 0 && willKeepAccess) {
      throw new Error("Cannot deactivate the last active user with settings access");
    }
  }

  const update: Partial<typeof schema.users.$inferInsert> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.username !== undefined) {
    const other = await getUserByUsername(input.username);
    if (other && other.id !== id) throw new Error("Username is already taken");
    update.username = input.username.toLowerCase();
  }
  if (input.email !== undefined) update.email = input.email;
  if (input.role !== undefined) update.role = input.role;
  if (input.active !== undefined) update.active = input.active;
  if (input.perms !== undefined) update.perms = input.perms;
  if (input.password) {
    const { hash, salt } = await hashPassword(input.password);
    update.passHash = hash;
    update.passSalt = salt;
  }

  await db.update(schema.users).set(update).where(eq(schema.users.id, id));
  return (await getUserById(id))!;
}

export async function deleteUser(id: string): Promise<void> {
  const existing = await getUserById(id);
  if (!existing) return;
  if (existing.active) {
    const otherCount = await countActiveUsersWithSettingsEdit(id);
    if (otherCount === 0 && existing.perms.settings.edit) {
      throw new Error("Cannot delete the last active user with settings access");
    }
  }
  await db.delete(schema.users).where(eq(schema.users.id, id));
}
