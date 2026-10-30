// node:sqlite è disponibile da Node 22+ (sperimentale, stabile in Node 26)
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname } from "path";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;

  const path = process.env.DATABASE_PATH ?? "./db/clasp.db";
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  _db = new DatabaseSync(path);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  return _db;
}

export function applySchema(db: DatabaseSync, schemaPath: string): void {
  db.exec(readFileSync(schemaPath, "utf8"));
}
