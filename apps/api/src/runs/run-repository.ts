import { and, desc, eq } from "drizzle-orm"
import type { DbOrTx } from "../db/client.js"
import { agentRuns, agentVersions, runtimeEnvironments, users } from "../db/schema.js"

export type RunRow = typeof agentRuns.$inferSelect
export interface RunWithContext {
  run: RunRow
  version: number
  creator: { id: string; email: string; name: string }
}

const withContext = {
  run: agentRuns,
  version: agentVersions.version,
  creator: { id: users.id, email: users.email, name: users.name },
}

export async function insertRun(
  db: DbOrTx,
  workspaceId: string,
  values: Pick<
    RunRow,
    "agentId" | "agentVersionId" | "userId" | "provider" | "runtimeSessionId" | "budgetCents"
  >,
): Promise<RunRow> {
  const [row] = await db
    .insert(agentRuns)
    .values({ ...values, workspaceId })
    .returning()
  if (!row) throw new Error("insert into agent_runs returned no row")
  return row
}

export async function findRun(
  db: DbOrTx,
  workspaceId: string,
  runId: string,
): Promise<RunWithContext | undefined> {
  const [row] = await db
    .select(withContext)
    .from(agentRuns)
    .innerJoin(agentVersions, eq(agentVersions.id, agentRuns.agentVersionId))
    .innerJoin(users, eq(users.id, agentRuns.userId))
    .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.id, runId)))
  return row
}

export async function listRuns(
  db: DbOrTx,
  workspaceId: string,
  agentId: string,
  limit = 20,
): Promise<RunWithContext[]> {
  return db
    .select(withContext)
    .from(agentRuns)
    .innerJoin(agentVersions, eq(agentVersions.id, agentRuns.agentVersionId))
    .innerJoin(users, eq(users.id, agentRuns.userId))
    .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.agentId, agentId)))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit)
}

export async function updateRun(
  db: DbOrTx,
  workspaceId: string,
  runId: string,
  patch: Partial<Pick<RunRow, "status" | "usage">>,
): Promise<void> {
  await db
    .update(agentRuns)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.id, runId)))
}

/** Runtime infrastructure shared by all workspaces; exempt from workspace scope. */
export async function findEnvironment(db: DbOrTx, provider: string): Promise<string | undefined> {
  const [row] = await db
    .select({ environmentId: runtimeEnvironments.environmentId })
    .from(runtimeEnvironments)
    .where(eq(runtimeEnvironments.provider, provider))
  return row?.environmentId
}

/** Runtime infrastructure shared by all workspaces; exempt from workspace scope. */
export async function saveEnvironment(
  db: DbOrTx,
  provider: string,
  environmentId: string,
): Promise<void> {
  await db
    .insert(runtimeEnvironments)
    .values({ provider, environmentId })
    .onConflictDoUpdate({ target: runtimeEnvironments.provider, set: { environmentId } })
}
