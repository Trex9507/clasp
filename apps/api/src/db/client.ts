import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { fileURLToPath } from "node:url"
import pg from "pg"
import * as schema from "./schema.js"

export type Db = NodePgDatabase<typeof schema>

export interface Database {
  db: Db
  close(): Promise<void>
}

// src/ and dist/ sit at the same depth, so this resolves from either.
const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url))

export function createDatabase(url: string): Database {
  const pool = new pg.Pool({ connectionString: url })
  return { db: drizzle(pool, { schema }), close: () => pool.end() }
}

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}
