import { and, asc, eq, inArray } from "drizzle-orm"
import type { DbOrTx } from "../db/client.js"
import { mcpConnections, runtimeVaults } from "../db/schema.js"

export type McpConnectionRow = typeof mcpConnections.$inferSelect
export type McpConnectionUpdate = Partial<
  Omit<McpConnectionRow, "id" | "workspaceId" | "createdBy" | "createdAt" | "updatedAt">
>

export async function listConnections(
  db: DbOrTx,
  workspaceId: string,
): Promise<McpConnectionRow[]> {
  return db
    .select()
    .from(mcpConnections)
    .where(eq(mcpConnections.workspaceId, workspaceId))
    .orderBy(asc(mcpConnections.name))
}

export async function findConnectionsByIds(
  db: DbOrTx,
  workspaceId: string,
  ids: string[],
): Promise<McpConnectionRow[]> {
  if (ids.length === 0) return []
  return db
    .select()
    .from(mcpConnections)
    .where(and(eq(mcpConnections.workspaceId, workspaceId), inArray(mcpConnections.id, ids)))
}

export async function findConnection(
  db: DbOrTx,
  workspaceId: string,
  connectionId: string,
): Promise<McpConnectionRow | undefined> {
  const [row] = await findConnectionsByIds(db, workspaceId, [connectionId])
  return row
}

export async function insertConnection(
  db: DbOrTx,
  workspaceId: string,
  values: Pick<McpConnectionRow, "createdBy" | "name" | "url" | "authType" | "credentialEncrypted">,
): Promise<McpConnectionRow> {
  const [row] = await db
    .insert(mcpConnections)
    .values({ ...values, workspaceId })
    .returning()
  if (!row) throw new Error("insert into mcp_connections returned no row")
  return row
}

export async function updateConnection(
  db: DbOrTx,
  workspaceId: string,
  connectionId: string,
  patch: McpConnectionUpdate,
): Promise<McpConnectionRow> {
  const [row] = await db
    .update(mcpConnections)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(mcpConnections.workspaceId, workspaceId), eq(mcpConnections.id, connectionId)))
    .returning()
  if (!row) throw new Error("update of mcp_connections matched no row")
  return row
}

export async function deleteConnection(
  db: DbOrTx,
  workspaceId: string,
  connectionId: string,
): Promise<void> {
  await db
    .delete(mcpConnections)
    .where(and(eq(mcpConnections.workspaceId, workspaceId), eq(mcpConnections.id, connectionId)))
}

export async function findVault(
  db: DbOrTx,
  workspaceId: string,
  provider: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ vaultId: runtimeVaults.vaultId })
    .from(runtimeVaults)
    .where(and(eq(runtimeVaults.workspaceId, workspaceId), eq(runtimeVaults.provider, provider)))
  return row?.vaultId
}

export async function saveVault(
  db: DbOrTx,
  workspaceId: string,
  provider: string,
  vaultId: string,
): Promise<void> {
  await db
    .insert(runtimeVaults)
    .values({ workspaceId, provider, vaultId })
    .onConflictDoUpdate({
      target: [runtimeVaults.workspaceId, runtimeVaults.provider],
      set: { vaultId },
    })
}
