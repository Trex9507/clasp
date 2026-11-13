import { eq } from "drizzle-orm"
import type { Db } from "../db/client.js"
import { users } from "../db/schema.js"

// Users are global identities, not workspace resources, so these reads are exempt from the
// workspace-scope rule (listed in tests/guards/workspace-scope.test.ts).

export type UserRow = typeof users.$inferSelect

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email))
  return row
}
