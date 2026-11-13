// The single writer for agents and agent versions (CLAUDE.md, I3).
//
// The Clasp database is the source of truth (I1). Saving commits to the database first and
// then pushes the version to the runtime; if the runtime is unreachable, the save still stands
// and the version is reported as not synced until a later save or POST .../sync succeeds.
import {
  findModel,
  type Agent,
  type AgentConfig,
  type AgentStatus,
  type AgentSummary,
  type AgentVersion,
  type CreateAgentRequest,
  type UpdateAgentRequest,
  type User,
} from "@clasp/shared"
import type { AgentRuntime } from "@clasp/runtime"
import type { FastifyBaseLogger } from "fastify"
import type { Db } from "../db/client.js"
import { ConflictError, NotFoundError } from "../errors.js"
import { assertWorkspaceAccess } from "../workspaces/workspace-service.js"
import {
  appendVersion,
  findAgent,
  findCurrentVersion,
  insertAgent,
  listAgents as listAgentRows,
  listVersions,
  markVersionSynced,
  setRuntimeRef,
  updateAgentFields,
  type AgentRow,
  type VersionWithCreator,
} from "./agent-repository.js"

export interface AgentDeps {
  db: Db
  runtime: AgentRuntime
  log: Pick<FastifyBaseLogger, "warn">
}

function toVersion({ version, creator }: VersionWithCreator): AgentVersion {
  return {
    id: version.id,
    version: version.version,
    model: version.model,
    language: version.language,
    effort: version.effort,
    systemPrompt: version.systemPrompt,
    runtimeSynced: version.runtimeSyncedVersion !== null,
    createdAt: version.createdAt.toISOString(),
    createdBy: creator,
  }
}

function toAgent(agent: AgentRow, current: VersionWithCreator): Agent {
  return {
    id: agent.id,
    workspaceId: agent.workspaceId,
    name: agent.name,
    description: agent.description,
    icon: agent.icon,
    status: agent.status,
    // "listed" is not settable through the API yet, so it cannot be stored either.
    visibility: agent.visibility === "listed" ? "workspace" : agent.visibility,
    currentVersion: toVersion(current),
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  }
}

function sameConfig(a: AgentConfig, b: Record<keyof AgentConfig, string>): boolean {
  return (
    a.model === b.model &&
    a.language === b.language &&
    a.effort === b.effort &&
    a.systemPrompt === b.systemPrompt
  )
}

async function loadAgent(deps: AgentDeps, workspaceId: string, agentId: string): Promise<Agent> {
  const agent = await findAgent(deps.db, workspaceId, agentId)
  const current = await findCurrentVersion(deps.db, workspaceId, agentId)
  if (!agent || !current) throw new NotFoundError("Agent not found")
  return toAgent(agent, current)
}

/** Pushes the agent's current version to the runtime. Never throws: failure leaves it unsynced. */
async function syncCurrentVersion(
  deps: AgentDeps,
  workspaceId: string,
  agentId: string,
): Promise<void> {
  const agent = await findAgent(deps.db, workspaceId, agentId)
  const current = await findCurrentVersion(deps.db, workspaceId, agentId)
  if (!agent || !current || agent.status !== "active") return
  const model = findModel(current.version.model)
  if (!model) {
    deps.log.warn({ agentId, model: current.version.model }, "unknown model; agent not synced")
    return
  }
  // A ref from another runtime (e.g. created on the fake runtime before a key was configured)
  // cannot be updated here, so the agent is created afresh in this runtime.
  const ref = agent.runtimeRef?.provider === deps.runtime.provider ? agent.runtimeRef : undefined
  try {
    const synced = await deps.runtime.upsertAgent(
      {
        claspAgentId: agent.id,
        claspVersionId: current.version.id,
        workspaceId,
        name: agent.name,
        description: agent.description,
        systemPrompt: current.version.systemPrompt,
        language: current.version.language,
        providerModelId: model.providerModelId,
        effort: current.version.effort,
      },
      ref ?? undefined,
    )
    await setRuntimeRef(deps.db, workspaceId, agentId, synced)
    await markVersionSynced(deps.db, workspaceId, current.version.id, synced.version)
  } catch (error) {
    deps.log.warn({ err: error, agentId }, "runtime sync failed; version saved but not synced")
  }
}

export async function listAgents(
  deps: AgentDeps,
  user: User,
  workspaceId: string,
  status: AgentStatus,
): Promise<AgentSummary[]> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const rows = await listAgentRows(deps.db, workspaceId, status)
  return rows.map(({ agent, version }) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    icon: agent.icon,
    status: agent.status,
    visibility: agent.visibility === "listed" ? "workspace" : agent.visibility,
    model: version.model,
    language: version.language,
    version: version.version,
    actionCount: version.actions.length,
    runtimeSynced: version.runtimeSyncedVersion !== null,
    updatedAt: agent.updatedAt.toISOString(),
  }))
}

export async function getAgent(
  deps: AgentDeps,
  user: User,
  workspaceId: string,
  agentId: string,
): Promise<Agent> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  return loadAgent(deps, workspaceId, agentId)
}

export async function listAgentVersions(
  deps: AgentDeps,
  user: User,
  workspaceId: string,
  agentId: string,
): Promise<AgentVersion[]> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const versions = await listVersions(deps.db, workspaceId, agentId)
  if (versions.length === 0) throw new NotFoundError("Agent not found")
  return versions.map(toVersion)
}

export async function createAgent(
  deps: AgentDeps,
  user: User,
  workspaceId: string,
  input: Required<CreateAgentRequest>,
): Promise<Agent> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const agentId = await deps.db.transaction(async (tx) => {
    const agent = await insertAgent(tx, workspaceId, {
      createdBy: user.id,
      name: input.name,
      description: input.description,
      icon: input.icon,
      visibility: input.visibility,
    })
    await appendVersion(tx, workspaceId, agent.id, { ...input.config, createdBy: user.id })
    return agent.id
  })
  await syncCurrentVersion(deps, workspaceId, agentId)
  return loadAgent(deps, workspaceId, agentId)
}

export async function updateAgent(
  deps: AgentDeps,
  user: User,
  workspaceId: string,
  agentId: string,
  patch: UpdateAgentRequest,
): Promise<Agent> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const needsSync = await deps.db.transaction(async (tx) => {
    // Lock the agent so concurrent saves get consecutive version numbers.
    const agent = await findAgent(tx, workspaceId, agentId, { forUpdate: true })
    const current = await findCurrentVersion(tx, workspaceId, agentId)
    if (!agent || !current) throw new NotFoundError("Agent not found")
    if (agent.status === "archived") throw new ConflictError("Archived agents cannot be changed")

    const { config, ...fields } = patch
    const configChanged = config !== undefined && !sameConfig(config, current.version)
    if (configChanged) {
      await appendVersion(tx, workspaceId, agentId, { ...config, createdBy: user.id })
    }
    await updateAgentFields(tx, workspaceId, agentId, fields)
    // The runtime also shows name and description, so those resync too.
    return (
      configChanged ||
      (fields.name !== undefined && fields.name !== agent.name) ||
      (fields.description !== undefined && fields.description !== agent.description)
    )
  })
  if (needsSync) await syncCurrentVersion(deps, workspaceId, agentId)
  return loadAgent(deps, workspaceId, agentId)
}

/** Retries pushing the current version when an earlier save could not reach the runtime. */
export async function syncAgent(
  deps: AgentDeps,
  user: User,
  workspaceId: string,
  agentId: string,
): Promise<Agent> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const agent = await loadAgent(deps, workspaceId, agentId)
  if (agent.status === "archived") throw new ConflictError("Archived agents are not hosted")
  await syncCurrentVersion(deps, workspaceId, agentId)
  return loadAgent(deps, workspaceId, agentId)
}

/** Archiving is permanent: the agent becomes read-only and is no longer hosted. Idempotent. */
export async function archiveAgent(
  deps: AgentDeps,
  user: User,
  workspaceId: string,
  agentId: string,
): Promise<void> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const agent = await findAgent(deps.db, workspaceId, agentId)
  if (!agent) throw new NotFoundError("Agent not found")
  if (agent.status === "archived") return
  await updateAgentFields(deps.db, workspaceId, agentId, { status: "archived" })
  if (agent.runtimeRef?.provider === deps.runtime.provider) {
    try {
      await deps.runtime.archiveAgent(agent.runtimeRef)
    } catch (error) {
      // The agent is archived in Clasp either way; a runtime agent left behind is unused.
      deps.log.warn({ err: error, agentId }, "runtime archive failed")
    }
  }
}
