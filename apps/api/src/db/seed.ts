// `pnpm --filter @clasp/api db:seed`: creates the development user and their personal workspace.
// Idempotent, so it is safe to run on every setup.
import { pathToFileURL } from "node:url"
import { loadConfig } from "../config.js"
import { createDatabase, type Db } from "./client.js"
import { users, workspaceMembers, workspaces } from "./schema.js"
import { eq } from "drizzle-orm"

export async function seedDevUser(db: Db, email: string): Promise<{ userId: string }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, email))
    if (existing) return { userId: existing.id }

    const [user] = await tx.insert(users).values({ email, name: "Dev User" }).returning()
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: "Personal", kind: "personal" })
      .returning()
    if (!user || !workspace) throw new Error("Seeding returned no rows")
    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId: user.id, role: "owner" })
    return { userId: user.id }
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const config = loadConfig()
  const database = createDatabase(config.DATABASE_URL)
  try {
    await seedDevUser(database.db, config.DEV_USER_EMAIL)
    console.log(`Seeded ${config.DEV_USER_EMAIL} with a personal workspace.`)
  } finally {
    await database.close()
  }
}
