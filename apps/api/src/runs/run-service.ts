// The single writer for agent runs. A run is one runtime session with a hosted agent; its row in
// agent_runs is the usage ledger (CLAUDE.md, I5). The runtime holds the transcript; Clasp keeps
// who ran what, on which version, its status and what it cost.
import type {
  Run,
  RunEvent,
  RunStatus,
  RunUsage,
  RunWithEvents,
  ToolDecisionRequest,
  User,
} from "@clasp/shared"
import { ConflictError, NotFoundError } from "../errors.js"
import { RuntimeError } from "@clasp/runtime"
import {
  hostedVersion,
  resyncAgent,
  runtimeServerName,
  type AgentDeps,
} from "../agents/agent-service.js"
import { findAgent } from "../agents/agent-repository.js"
import { findVault, listConnections } from "../mcp/mcp-connection-repository.js"
import { assertWorkspaceAccess } from "../workspaces/workspace-service.js"
import {
  findEnvironment,
  findRun,
  insertRun,
  listRuns as listRunRows,
  saveEnvironment,
  updateRun,
  type RunWithContext,
} from "./run-repository.js"

export interface RunDeps extends AgentDeps {
  /** Spending cap for each playground run, in US cents. */
  budgetCents: number
}

/** Statuses after which the agent does no more work until the user acts. */
const SETTLED: RunStatus[] = ["idle", "awaiting_approval", "budget_reached", "ended", "error"]

function toRun({ run, version, creator }: RunWithContext): Run {
  return {
    id: run.id,
    agentId: run.agentId,
    agentVersion: version,
    status: run.status,
    usage: run.usage,
    budgetCents: run.budgetCents,
    createdBy: creator,
    startedAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }
}

async function loadRun(deps: RunDeps, user: User, workspaceId: string, runId: string) {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const row = await findRun(deps.db, workspaceId, runId)
  if (!row) throw new NotFoundError("Run not found")
  if (row.run.provider !== deps.runtime.provider) {
    throw new ConflictError("This run belongs to a different runtime and cannot be resumed")
  }
  return row
}

/** Replaces runtime MCP server names with the connection names users know. */
async function connectionNamer(deps: RunDeps, workspaceId: string) {
  const names = new Map(
    (await listConnections(deps.db, workspaceId)).map((c) => [runtimeServerName(c.id), c.name]),
  )
  return (event: RunEvent): RunEvent =>
    event.kind === "tool_call"
      ? { ...event, connectionName: names.get(event.connectionName) ?? event.connectionName }
      : event
}

export async function startRun(
  deps: RunDeps,
  user: User,
  workspaceId: string,
  agentId: string,
): Promise<RunWithEvents> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  const agent = await findAgent(deps.db, workspaceId, agentId)
  if (!agent) throw new NotFoundError("Agent not found")
  let { ref, versionId } = await hostedVersion(deps, workspaceId, agentId)

  const provider = deps.runtime.provider
  const existingEnv = await findEnvironment(deps.db, provider)
  const environmentId = await deps.runtime.ensureEnvironment(existingEnv)
  if (environmentId !== existingEnv) await saveEnvironment(deps.db, provider, environmentId)
  const vaultId = await findVault(deps.db, workspaceId, provider)

  const start = () =>
    deps.runtime.startSession({
      agent: ref,
      environmentId,
      vaultIds: vaultId ? [vaultId] : [],
      budgetCents: deps.budgetCents,
      title: `Playground: ${agent.name}`,
      metadata: {
        clasp_workspace_id: workspaceId,
        clasp_agent_id: agentId,
        clasp_user_id: user.id,
      },
    })
  let sessionId: string
  try {
    ;({ sessionId } = await start())
  } catch (error) {
    if (!(error instanceof RuntimeError)) throw error
    // The runtime may have lost the agent (a restarted fake runtime, or one removed there):
    // host it again and retry once.
    deps.log.warn({ err: error, agentId }, "session start failed; re-hosting the agent")
    await resyncAgent(deps, workspaceId, agentId)
    ;({ ref, versionId } = await hostedVersion(deps, workspaceId, agentId))
    ;({ sessionId } = await start())
  }
  const run = await insertRun(deps.db, workspaceId, {
    agentId,
    agentVersionId: versionId,
    userId: user.id,
    provider,
    runtimeSessionId: sessionId,
    budgetCents: deps.budgetCents,
  })
  const row = await findRun(deps.db, workspaceId, run.id)
  if (!row) throw new Error("run vanished after insert")
  return { ...toRun(row), events: [] }
}

export async function listRuns(
  deps: RunDeps,
  user: User,
  workspaceId: string,
  agentId: string,
): Promise<Run[]> {
  await assertWorkspaceAccess(deps.db, workspaceId, user.id)
  if (!(await findAgent(deps.db, workspaceId, agentId))) throw new NotFoundError("Agent not found")
  return (await listRunRows(deps.db, workspaceId, agentId)).map(toRun)
}

export async function getRun(
  deps: RunDeps,
  user: User,
  workspaceId: string,
  runId: string,
): Promise<RunWithEvents> {
  const row = await loadRun(deps, user, workspaceId, runId)
  const name = await connectionNamer(deps, workspaceId)
  const events = (await deps.runtime.listEvents(row.run.runtimeSessionId)).map(name)
  return { ...toRun(row), events }
}

export async function sendRunMessage(
  deps: RunDeps,
  user: User,
  workspaceId: string,
  runId: string,
  text: string,
): Promise<void> {
  const { run } = await loadRun(deps, user, workspaceId, runId)
  if (run.status === "awaiting_approval") {
    throw new ConflictError("Approve or deny the pending action first")
  }
  if (run.status === "budget_reached") throw new ConflictError("This run reached its spending cap")
  if (run.status === "ended" || run.status === "error")
    throw new ConflictError("This run has ended")
  await deps.runtime.sendMessage(run.runtimeSessionId, text)
  await updateRun(deps.db, workspaceId, runId, { status: "running" })
}

export async function decideRunTool(
  deps: RunDeps,
  user: User,
  workspaceId: string,
  runId: string,
  decision: ToolDecisionRequest,
): Promise<void> {
  const { run } = await loadRun(deps, user, workspaceId, runId)
  await deps.runtime.decideTool(
    run.runtimeSessionId,
    decision.toolCallId,
    decision.decision,
    decision.denyMessage,
  )
  await updateRun(deps.db, workspaceId, runId, { status: "running" })
}

export async function interruptRun(
  deps: RunDeps,
  user: User,
  workspaceId: string,
  runId: string,
): Promise<void> {
  const { run } = await loadRun(deps, user, workspaceId, runId)
  await deps.runtime.interrupt(run.runtimeSessionId)
}

/** Checks access before a stream response starts, so errors can still be JSON. */
export async function assertRunAccess(
  deps: RunDeps,
  user: User,
  workspaceId: string,
  runId: string,
): Promise<void> {
  await loadRun(deps, user, workspaceId, runId)
}

/**
 * The run's events: history first, then live, deduplicated by ID. The live stream is opened
 * before history is fetched (the runtime stream has no replay), so nothing falls in the gap.
 * Status changes and usage are written to the ledger as they arrive.
 */
export async function* streamRun(
  deps: RunDeps,
  user: User,
  workspaceId: string,
  runId: string,
  signal: AbortSignal,
): AsyncGenerator<RunEvent> {
  const { run } = await loadRun(deps, user, workspaceId, runId)
  const name = await connectionNamer(deps, workspaceId)
  const seen = new Set<string>()

  const live = deps.runtime.streamEvents(run.runtimeSessionId, signal)[Symbol.asyncIterator]()
  // Start the live stream now: an async generator only opens its connection on first next().
  let pending = live.next()

  const record = async (event: RunEvent): Promise<RunEvent | undefined> => {
    if (event.kind !== "status") return undefined
    const patch: { status: RunStatus; usage?: RunUsage } = { status: event.status }
    let usageEvent: RunEvent | undefined
    if (SETTLED.includes(event.status)) {
      try {
        patch.usage = await deps.runtime.getUsage(run.runtimeSessionId)
        usageEvent = { id: `usage-${event.id}`, at: event.at, kind: "usage", usage: patch.usage }
      } catch (error) {
        deps.log.warn({ err: error, runId }, "could not read run usage")
      }
    }
    await updateRun(deps.db, workspaceId, runId, patch)
    return usageEvent
  }

  for (const event of await deps.runtime.listEvents(run.runtimeSessionId)) {
    seen.add(event.id)
    yield name(event)
  }

  try {
    while (!signal.aborted) {
      const next = await pending
      if (next.done) return
      pending = live.next()
      const event = next.value
      if (seen.has(event.id)) continue
      seen.add(event.id)
      yield name(event)
      const usage = await record(event)
      if (usage) yield usage
    }
  } finally {
    await live.return?.(undefined)
  }
}
