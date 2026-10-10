import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";
let instance: NodePgDatabase<typeof schema> | undefined;
export function db() {
  if (!instance) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    attachDatabasePool(pool);
    instance = drizzle(pool, { schema });
  }
  return instance;
}
export type DB = ReturnType<typeof db>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
