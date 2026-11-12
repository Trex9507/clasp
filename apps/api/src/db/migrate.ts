// `pnpm --filter @clasp/api db:migrate`: applies pending migrations from apps/api/drizzle.
import { loadConfig } from "../config.js"
import { createDatabase, runMigrations } from "./client.js"

const { DATABASE_URL } = loadConfig()
const database = createDatabase(DATABASE_URL)
try {
  await runMigrations(database.db)
  console.log("Migrations applied.")
} finally {
  await database.close()
}
