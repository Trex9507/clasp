// Per-file test harness: a database handle, a clean slate before each test, and an app instance.
import { sql } from "drizzle-orm"
import type { FastifyInstance } from "fastify"
import { afterAll, beforeEach, inject } from "vitest"
import { FakeRuntime } from "@clasp/runtime"
import { buildApp } from "../app.js"
import { createDatabase, type Db } from "../db/client.js"
import { seedDevUser } from "../db/seed.js"
import { users, workspaceMembers, workspaces } from "../db/schema.js"

export const DEV_EMAIL = "dev@clasp.local"
const TEST_KEY = Buffer.alloc(32, 7).toString("base64")

export function useTestApp() {
  const database = createDatabase(inject("databaseUrl"))
  const ctx = {} as { app: FastifyInstance; db: Db; devUserId: string; runtime: FakeRuntime }
  ctx.db = database.db

  beforeEach(async () => {
    await database.db.execute(
      sql`TRUNCATE users, workspaces, workspace_members, agents, agent_versions, mcp_connections, runtime_vaults, agent_runs, runtime_environments CASCADE`,
    )
    ctx.devUserId = (await seedDevUser(database.db, DEV_EMAIL)).userId
    ctx.runtime = new FakeRuntime()
    ctx.app = await buildApp({
      runtime: ctx.runtime,
      config: {
        CORS_ORIGINS: [],
        DEV_USER_EMAIL: DEV_EMAIL,
        CREDENTIAL_ENCRYPTION_KEY: TEST_KEY,
        MCP_ALLOW_PRIVATE_HOSTS: true,
        NODE_ENV: "test",
        RUN_BUDGET_CENTS: 100,
      },
      db: database.db,
    })
  })

  afterAll(async () => {
    await ctx.app?.close()
    await database.close()
  })

  return ctx
}

/** Creates another user who owns a workspace the dev user is not a member of. */
export async function createForeignWorkspace(db: Db): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: "other@example.com", name: "Other" })
    .returning()
  const [ws] = await db
    .insert(workspaces)
    .values({ name: "Other Co", kind: "organization" })
    .returning()
  if (!user || !ws) throw new Error("insert returned no rows")
  await db.insert(workspaceMembers).values({ workspaceId: ws.id, userId: user.id, role: "owner" })
  return ws.id
}
