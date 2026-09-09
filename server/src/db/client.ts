import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../../../drizzle/schema";

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL ?? "mysql://thoth:thothdev@localhost:3306/thoth_pos",
  connectionLimit: 10,
});

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
