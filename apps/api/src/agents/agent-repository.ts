import { and, desc, eq, sql } from "drizzle-orm"
import type { AgentStatus } from "@clasp/shared"
import type { DbOrTx } from "../db/client.js"
import { agents, agentVersions, users, type RuntimeRef } from "../db/schema.js"

export type AgentRow = typeof agents.$inferSelect
export type AgentVersionRow = typeof agentVersions.$inferSelect
export type NewAgentVersion = Omit<
  typeof agentVersions.$inferInsert,
  "id" | "agentId" | "version" | "createdAt" | "runtimeSyncedVersion"
>
export interface VersionWithCreator {
  version: AgentVersionRow
  creator: { id: string; email: string; name: string }
}

const creatorColumns = { id: users.id, email: users.email, name: users.name }

export async function listAgents(db: DbOrTx, workspaceId: string, status: AgentStatus) {
  return db
    .select({ agent: agents, version: agentVersions })
    .from(agents)
    .innerJoin(agentVersions, eq(agentVersions.id, agents.currentVersionId))
    .where(and(eq(agents.workspaceId, workspaceId), eq(agents.status, status)))
    .orderBy(desc(agents.updatedAt))
}

export async function findAgent(
  db: DbOrTx,
  workspaceId: string,
  agentId: string,
  options: { forUpdate?: boolean } = {},
): Promise<AgentRow | undefined> {
  const query = db
    .select()
    .from(agents)
    .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
  const [row] = options.forUpdate ? await query.for("update") : await query
  return row
}

export async function findCurrentVersion(
  db: DbOrTx,
  workspaceId: string,
  agentId: string,
): Promise<VersionWithCreator | undefined> {
  const [row] = await db
    .select({ version: agentVersions, creator: creatorColumns })
    .from(agents)
    .innerJoin(agentVersions, eq(agentVersions.id, agents.currentVersionId))
    .innerJoin(users, eq(users.id, agentVersions.createdBy))
    .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
  return row
}

export async function listVersions(
  db: DbOrTx,
  workspaceId: string,
  agentId: string,
): Promise<VersionWithCreator[]> {
  return db
    .select({ version: agentVersions, creator: creatorColumns })
    .from(agentVersions)
    .innerJoin(agents, eq(agents.id, agentVersions.agentId))
    .innerJoin(users, eq(users.id, agentVersions.createdBy))
    .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
    .orderBy(desc(agentVersions.version))
}

export async function insertAgent(
  db: DbOrTx,
  workspaceId: string,
  values: Pick<AgentRow, "createdBy" | "name" | "description" | "icon" | "visibility">,
): Promise<AgentRow> {
  const [row] = await db
    .insert(agents)
    .values({ ...values, workspaceId })
    .returning()
  if (!row) throw new Error("insert into agents returned no row")
  return row
}

/** Appends the next version and makes it current. Call inside a transaction holding the agent lock. */
export async function appendVersion(
  db: DbOrTx,
  workspaceId: string,
  agentId: string,
  values: NewAgentVersion,
): Promise<AgentVersionRow> {
  const [{ next } = { next: 1 }] = await db
    .select({ next: sql<number>`coalesce(max(${agentVersions.version}), 0) + 1` })
    .from(agentVersions)
    .where(eq(agentVersions.agentId, agentId))
  const [version] = await db
    .insert(agentVersions)
    .values({ ...values, agentId, version: Number(next) })
    .returning()
  if (!version) throw new Error("insert into agent_versions returned no row")
  await db
    .update(agents)
    .set({ currentVersionId: version.id })
    .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
  return version
}

export async function updateAgentFields(
  db: DbOrTx,
  workspaceId: string,
  agentId: string,
  patch: Partial<Pick<AgentRow, "name" | "description" | "icon" | "visibility" | "status">>,
): Promise<void> {
  // Always touch updated_at, including for a config-only change.
  await db
    .update(agents)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
}

export async function setRuntimeRef(
  db: DbOrTx,
  workspaceId: string,
  agentId: string,
  ref: RuntimeRef,
): Promise<void> {
  await db
    .update(agents)
    .set({ runtimeRef: ref })
    .where(and(eq(agents.workspaceId, workspaceId), eq(agents.id, agentId)))
}

export async function markVersionSynced(
  db: DbOrTx,
  workspaceId: string,
  versionId: string,
  runtimeVersion: number,
): Promise<void> {
  await db
    .update(agentVersions)
    .set({ runtimeSyncedVersion: runtimeVersion })
    .where(
      and(
        eq(agentVersions.id, versionId),
        sql`${agentVersions.agentId} in (select ${agents.id} from ${agents} where ${agents.workspaceId} = ${workspaceId})`,
      ),
    )
}
