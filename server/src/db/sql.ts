import type { SQL } from "drizzle-orm";
import { db } from "./client";

/** db.execute() returns a [rows, fields] tuple (mysql2 driver shape) — unwrap to just the rows. */
export async function rows<T = any>(query: SQL): Promise<T[]> {
  const [result] = (await db.execute(query)) as unknown as [T[], unknown];
  return result;
}
