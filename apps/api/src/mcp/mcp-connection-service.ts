// The single writer for MCP connections (CLAUDE.md, I3).
//
// A bearer token is encrypted at rest here and mirrored into the workspace's runtime vault, which
// injects it when a hosted agent calls the server. The API never returns it (CLAUDE.md, rule 2).
import type {
  CreateMcpConnectionRequest,
  McpConnection,
  UpdateMcpConnectionRequest,
  User,
} from "@clasp/shared"
import type { RuntimeVaultRef } from "@clasp/runtime"
import { DatabaseError } from "pg"
import type { SecretBox } from "../crypto.js"
import { ConflictError, NotFoundError, ServiceUnavailableError, UpstreamError } from "../errors.js"
import {
  agentsUsingConnection,
  resyncAgentsUsingConnection,
  type AgentDeps,
} from "../agents/agent-service.js"
import { listActiveAgentActions } from "../agents/agent-repository.js"
import { assertWorkspaceAccess } from "../workspaces/workspace-service.js"
import type { DiscoverTools } from "./discovery.js"
import {
  deleteConnection as deleteConnectionRow,
  findConnection,
  findVault,
  insertConnection,
  listConnections as listConnectionRows,
  saveVault,
  updateConnection as updateConnectionRow,
  type McpConnectionRow,
  type McpConnectionUpdate,
} from "./mcp-connection-repository.js"

export interface McpDeps extends AgentDeps {
  discover: DiscoverTools
  allowPrivateHosts: boolean
  /** Undefined when CREDENTIAL_ENCRYPTION_KEY is not configured. */
  secrets: SecretBox | undefined
}

// Runtime vaults hold at most 20 credentials.
const MAX_CREDENTIALS = 20

function toConnection(
  row: McpConnectionRow,
  usedBy: { id: string; name: string }[],
): McpConnection {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    authType: row.authType,
    hasCredential: row.credentialEncrypted !== null,
    status: row.status,
    lastError: row.lastError,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    tools: row.tools,
    usedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function requireSecrets(deps: McpDeps): SecretBox {
  if (!deps.secrets) {
    throw new ServiceUnavailableError(
      "Saving tokens is disabled: the server has no CREDENTIAL_ENCRYPTION_KEY configured",
    )
  }
  return deps.secrets
}

async function present(deps: McpDeps, workspaceId: string, row: McpConnectionRow) {
  return toConnection(row, await agentsUsingConnection(deps.db, workspaceId, row.id))
}

async function loadConnection(deps: McpDeps, workspaceId: string, connectionId: string) {
  const row = await findConnection(deps.db, workspaceId, connectionId)
  if (!row) throw new NotFoundError("Connection not found")
  return row
}

async function workspaceVault(deps: McpDeps, workspaceId: string) {
  const provider = deps.runtime.provider
  const existingId = await findVault(deps.db, workspaceId, provider)
  const existing: RuntimeVaultRef | undefined = existingId
    ? { provider, vaultId: existingId }
    : undefined
  const vault = await deps.runtime.ensureVault(workspaceId, existing)
  if (vault.vaultId !== existingId) await saveVault(deps.db, workspaceId, provider, vault.vaultId)
  return { vault, fresh: vault.vaultId !== existingId }
}

/** Mirrors the connection's token into the runtime vault. Failures are logged, not thrown. */
async function syncCredential(deps: McpDeps, workspaceId: string, row: McpConnectionRow) {
  try {
    const { vault, fresh } = await workspaceVault(deps, workspaceId)
    // A credential ID from another vault (e.g. before switching runtimes) cannot be replaced.
    const existingId = fresh ? undefined : (row.runtimeCredentialId ?? undefined)
    if (!row.credentialEncrypted) {
      if (existingId) await deps.runtime.deleteCredential(vault, existingId)
      if (row.runtimeCredentialId) {
        await updateConnectionRow(deps.db, workspaceId, row.id, { runtimeCredentialId: null })
      }
      return
    }
    const token = requireSecrets(deps).decrypt(row.credentialEncrypted)
    const credentialId = await deps.runtime.putCredential(
      vault,
      { url: row.url, token, label: `Clasp: ${row.name}` },
      existingId,
    )
    await updateConnectionRow(deps.db, workspaceId, row.id, { runtimeCredentialId: credentialId })
  } catch (error) {
    deps.log.warn({ err: error, connectionId: row.id }, "credential sync to the runtime failed")
  }
}

/** Lists the server's tools and records the outcome on the connection. */
async function runDiscovery(deps: McpDeps, workspaceId: string, row: McpConnectionRow) {
  const bearerToken = row.credentialEncrypted
    ? requireSecrets(deps).decrypt(row.credentialEncrypted)
    : undefined
  try {
    const tools = await deps.discover(row.url, {
      bearerToken,
      allowPrivateHosts: deps.allowPrivateHosts,
    })
    const updated = await updateConnectionRow(deps.db, workspaceId, row.id, {
      tools,
      status: "ok",
      lastError: null,
      lastCheckedAt: new Date(),
    })
    return { row: updated, error: undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const updated = await updateConnectionRow(deps.db, workspaceId, row.id, {
      status: "error",
      lastError: message,
      lastCheckedAt: new Date(),
    })
    return { row: updated, error: message }
  }
}

function toolKey(row: McpConnectionRow) {
  return JSON.stringify(row.tools.map((t) => t.name).sort())
}

export async function listConnections(
  deps: McpDeps,
  user: User,
  workspaceId: string,
): Promise<McpConnection[]> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const [rows, agentActions] = await Promise.all([
    listConnectionRows(deps.db, workspaceId),
    listActiveAgentActions(deps.db, workspaceId),
  ])
  return rows.map((row) =>
    toConnection(
      row,
      agentActions
        .filter((a) =>
          (a.actions as { connectionId?: string }[]).some((x) => x.connectionId === row.id),
        )
        .map(({ id, name }) => ({ id, name })),
    ),
  )
}

export async function getConnection(
  deps: McpDeps,
  user: User,
  workspaceId: string,
  connectionId: string,
): Promise<McpConnection> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  return present(deps, workspaceId, await loadConnection(deps, workspaceId, connectionId))
}

export async function createConnection(
  deps: McpDeps,
  user: User,
  workspaceId: string,
  input: CreateMcpConnectionRequest & { authType: "none" | "bearer" },
): Promise<McpConnection> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const bearer = input.authType === "bearer" && input.bearerToken ? input.bearerToken : undefined
  if (bearer) {
    const withTokens = (await listConnectionRows(deps.db, workspaceId)).filter(
      (c) => c.credentialEncrypted,
    )
    if (withTokens.length >= MAX_CREDENTIALS) {
      throw new ConflictError(
        `A workspace can hold at most ${MAX_CREDENTIALS} connections with tokens`,
      )
    }
  }
  let row: McpConnectionRow
  try {
    row = await insertConnection(deps.db, workspaceId, {
      createdBy: user.id,
      name: input.name,
      url: input.url,
      authType: input.authType,
      credentialEncrypted: bearer ? requireSecrets(deps).encrypt(bearer) : null,
    })
  } catch (error) {
    throw uniqueUrlConflict(error)
  }
  if (row.credentialEncrypted) await syncCredential(deps, workspaceId, row)
  const { row: discovered } = await runDiscovery(deps, workspaceId, row)
  return present(deps, workspaceId, discovered)
}

export async function updateConnection(
  deps: McpDeps,
  user: User,
  workspaceId: string,
  connectionId: string,
  patch: UpdateMcpConnectionRequest,
): Promise<McpConnection> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const before = await loadConnection(deps, workspaceId, connectionId)
  const authType = patch.authType ?? before.authType
  const changes: McpConnectionUpdate = {}
  if (patch.name !== undefined) changes.name = patch.name
  if (patch.url !== undefined) changes.url = patch.url
  if (patch.authType !== undefined) changes.authType = patch.authType
  if (authType === "none") changes.credentialEncrypted = null
  else if (patch.bearerToken)
    changes.credentialEncrypted = requireSecrets(deps).encrypt(patch.bearerToken)
  else if (!before.credentialEncrypted) {
    throw new ConflictError("Paste the bearer token to use bearer authentication")
  }

  let row: McpConnectionRow
  try {
    row = await updateConnectionRow(deps.db, workspaceId, connectionId, changes)
  } catch (error) {
    throw uniqueUrlConflict(error)
  }
  const urlChanged = row.url !== before.url
  const credentialChanged = row.credentialEncrypted !== before.credentialEncrypted
  if (urlChanged || credentialChanged || (patch.name && row.credentialEncrypted)) {
    await syncCredential(deps, workspaceId, row)
  }
  if (urlChanged || credentialChanged) {
    row = (await runDiscovery(deps, workspaceId, row)).row
  }
  if (urlChanged || toolKey(row) !== toolKey(before)) {
    await resyncAgentsUsingConnection(deps, workspaceId, connectionId)
  }
  return present(deps, workspaceId, row)
}

export async function discoverConnection(
  deps: McpDeps,
  user: User,
  workspaceId: string,
  connectionId: string,
): Promise<McpConnection> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const before = await loadConnection(deps, workspaceId, connectionId)
  if (before.credentialEncrypted && !before.runtimeCredentialId) {
    await syncCredential(deps, workspaceId, before)
  }
  const { row, error } = await runDiscovery(deps, workspaceId, before)
  if (toolKey(row) !== toolKey(before)) {
    await resyncAgentsUsingConnection(deps, workspaceId, connectionId)
  }
  if (error) throw new UpstreamError(error)
  return present(deps, workspaceId, row)
}

export async function deleteConnection(
  deps: McpDeps,
  user: User,
  workspaceId: string,
  connectionId: string,
): Promise<void> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const row = await loadConnection(deps, workspaceId, connectionId)
  const usedBy = await agentsUsingConnection(deps.db, workspaceId, connectionId)
  if (usedBy.length > 0) {
    const names = usedBy.map((a) => a.name).join(", ")
    throw new ConflictError(`Used by ${names}. Remove its actions from those agents first.`)
  }
  if (row.runtimeCredentialId) {
    try {
      const { vault, fresh } = await workspaceVault(deps, workspaceId)
      if (!fresh) await deps.runtime.deleteCredential(vault, row.runtimeCredentialId)
    } catch (error) {
      deps.log.warn({ err: error, connectionId }, "runtime credential delete failed")
    }
  }
  await deleteConnectionRow(deps.db, workspaceId, connectionId)
}

function uniqueUrlConflict(error: unknown): unknown {
  const cause = error instanceof Error && error.cause instanceof DatabaseError ? error.cause : error
  if (cause instanceof DatabaseError && cause.code === "23505") {
    return new ConflictError("This workspace already has a connection to that URL")
  }
  return error
}
