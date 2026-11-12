// node:sqlite ships unflagged from Node 22.13 (still marked experimental).
import { DatabaseSync } from "node:sqlite"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

// src/ and dist/ sit at the same depth, so these resolve from either, whatever
// directory the process was started in.
const ESCROW_DB_DIR = new URL("../../../db/escrow/", import.meta.url)
export const DEFAULT_SCHEMA_PATH = fileURLToPath(new URL("schema.sql", ESCROW_DB_DIR))
export const DEFAULT_DATABASE_PATH = fileURLToPath(new URL("clasp.db", ESCROW_DB_DIR))

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (db) return db

  const path = process.env.ESCROW_DATABASE_PATH ?? DEFAULT_DATABASE_PATH
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  db = new DatabaseSync(path)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA foreign_keys = ON")
  return db
}

export function applySchema(target: DatabaseSync, schemaPath = DEFAULT_SCHEMA_PATH): void {
  target.exec(readFileSync(schemaPath, "utf8"))
}
