import { randomUUID } from "node:crypto"
import type { RunEvent, RunStatus, RunUsage } from "@clasp/shared"
import { buildSystemPrompt } from "./system-prompt.js"
import {
  RuntimeError,
  type AgentRuntime,
  type AgentVersionSpec,
  type McpCredential,
  type RuntimeAgentRef,
  type RuntimeVaultRef,
  type StartSessionOptions,
} from "./types.js"

interface FakeAgent {
  versions: { spec: AgentVersionSpec; system: string }[]
  archived: boolean
}

// Omit applied to each member of the union, so each event kind keeps its own fields.
type NewRunEvent = RunEvent extends infer E
  ? E extends RunEvent
    ? Omit<E, "id" | "at">
    : never
  : never

interface FakeSession {
  spec: AgentVersionSpec
  budgetCents: number
  events: RunEvent[]
  listeners: Set<(event: RunEvent) => void>
  pending: Map<string, { toolName: string; serverName: string }>
  usage: RunUsage
}

/**
 * In-memory runtime for tests and for local development without an Anthropic key. It mirrors
 * the Managed Agents contract that matters to the platform: create returns version 1, an update
 * that changes nothing keeps the version, and archived agents reject updates.
 */
export class FakeRuntime implements AgentRuntime {
  readonly provider = "fake"
  readonly agents = new Map<string, FakeAgent>()
  /** vaultId -> credentialId -> credential */
  readonly vaults = new Map<string, Map<string, McpCredential>>()
  readonly sessions = new Map<string, FakeSession>()
  /** Set to make the next call fail, to exercise the platform's not-synced path. */
  failNext: string | undefined

  private maybeFail(): void {
    if (this.failNext) {
      const message = this.failNext
      this.failNext = undefined
      throw new RuntimeError(message)
    }
  }

  async upsertAgent(spec: AgentVersionSpec, ref?: RuntimeAgentRef): Promise<RuntimeAgentRef> {
    this.maybeFail()
    const system = buildSystemPrompt(spec.systemPrompt, spec.language, spec.actions)
    if (!ref) {
      const agentId = `fake_agent_${randomUUID()}`
      this.agents.set(agentId, { versions: [{ spec, system }], archived: false })
      return { provider: this.provider, agentId, version: 1 }
    }
    const agent = this.agents.get(ref.agentId)
    if (!agent) {
      // Memory is lost on every API restart; adopt the stored ref so local dev keeps working.
      this.agents.set(ref.agentId, { versions: [{ spec, system }], archived: false })
      return { provider: this.provider, agentId: ref.agentId, version: ref.version + 1 }
    }
    if (agent.archived) throw new RuntimeError(`Runtime agent ${ref.agentId} is archived`)
    const last = agent.versions.at(-1)
    const unchanged =
      last?.system === system &&
      last.spec.providerModelId === spec.providerModelId &&
      last.spec.effort === spec.effort &&
      last.spec.name === spec.name &&
      last.spec.description === spec.description &&
      JSON.stringify(last.spec.mcpServers) === JSON.stringify(spec.mcpServers)
    if (!unchanged) agent.versions.push({ spec, system })
    return { provider: this.provider, agentId: ref.agentId, version: agent.versions.length }
  }

  async archiveAgent(ref: RuntimeAgentRef): Promise<void> {
    this.maybeFail()
    const agent = this.agents.get(ref.agentId)
    if (agent) agent.archived = true
  }

  async ensureVault(workspaceId: string, existing?: RuntimeVaultRef): Promise<RuntimeVaultRef> {
    this.maybeFail()
    if (existing && this.vaults.has(existing.vaultId)) return existing
    const vaultId = existing?.vaultId ?? `fake_vault_${workspaceId}`
    this.vaults.set(vaultId, new Map())
    return { provider: this.provider, vaultId }
  }

  async putCredential(
    vault: RuntimeVaultRef,
    credential: McpCredential,
    existingId?: string,
  ): Promise<string> {
    this.maybeFail()
    const store = this.vaults.get(vault.vaultId)
    if (!store) throw new RuntimeError(`Unknown vault ${vault.vaultId}`)
    if (existingId) store.delete(existingId)
    const id = `fake_cred_${randomUUID()}`
    store.set(id, credential)
    return id
  }

  async deleteCredential(vault: RuntimeVaultRef, credentialId: string): Promise<void> {
    this.maybeFail()
    this.vaults.get(vault.vaultId)?.delete(credentialId)
  }

  // --- Simulated sessions ----------------------------------------------------------------------
  // The agent echoes messages. A message that names one of its actions' tools triggers that tool:
  // "ask" actions pause for a decision first, "auto" ones run at once with a canned result.

  async ensureEnvironment(existing?: string): Promise<string> {
    this.maybeFail()
    return existing ?? "fake_env"
  }

  async startSession(options: StartSessionOptions): Promise<{ sessionId: string }> {
    this.maybeFail()
    const agent = this.agents.get(options.agent.agentId)
    const version = agent?.versions[options.agent.version - 1] ?? agent?.versions.at(-1)
    if (!agent || !version) throw new RuntimeError(`Unknown runtime agent ${options.agent.agentId}`)
    if (agent.archived) throw new RuntimeError("Archived agents cannot start sessions")
    const sessionId = `fake_session_${randomUUID()}`
    this.sessions.set(sessionId, {
      spec: version.spec,
      budgetCents: options.budgetCents,
      events: [],
      listeners: new Set(),
      pending: new Map(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costCents: 0,
      },
    })
    return { sessionId }
  }

  private session(sessionId: string): FakeSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new RuntimeError(`Unknown session ${sessionId}`)
    return session
  }

  private emit(session: FakeSession, event: NewRunEvent) {
    const full = {
      id: `fake_evt_${randomUUID()}`,
      at: new Date().toISOString(),
      ...event,
    } as RunEvent
    session.events.push(full)
    for (const listener of session.listeners) listener(full)
    return full
  }

  private status(session: FakeSession, status: RunStatus, pendingToolCallIds: string[] = []) {
    this.emit(session, { kind: "status", status, pendingToolCallIds })
  }

  private reply(session: FakeSession, text: string) {
    session.usage.inputTokens += 40
    session.usage.outputTokens += Math.max(1, text.split(/\s+/).length)
    this.emit(session, { kind: "agent_message", text })
    this.emit(session, { kind: "usage", usage: { ...session.usage } })
    this.status(session, "idle")
  }

  private runTool(session: FakeSession, callId: string, toolName: string) {
    this.emit(session, {
      kind: "tool_result",
      toolCallId: callId,
      output: `Simulated result of ${toolName}.`,
      isError: false,
    })
    this.reply(session, `[Simulated] I used ${toolName} and got a simulated result.`)
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    this.maybeFail()
    const session = this.session(sessionId)
    if (session.pending.size > 0) throw new RuntimeError("A tool call is waiting for a decision")
    this.emit(session, { kind: "user_message", text })
    this.status(session, "running")
    // Let the caller's request finish before the "agent" answers, like a real runtime.
    setImmediate(() => {
      for (const server of session.spec.mcpServers) {
        const tool = server.tools.find((t) => text.includes(t.name))
        if (!tool) continue
        const call = this.emit(session, {
          kind: "tool_call",
          toolName: tool.name,
          connectionName: server.name,
          input: { query: text },
          permission: tool.permission === "auto" ? "allow" : "ask",
        })
        if (tool.permission === "auto") return this.runTool(session, call.id, tool.name)
        session.pending.set(call.id, { toolName: tool.name, serverName: server.name })
        return this.status(session, "awaiting_approval", [call.id])
      }
      this.reply(session, `[Simulated] You said: ${text}`)
    })
  }

  async decideTool(
    sessionId: string,
    toolCallId: string,
    decision: "allow" | "deny",
  ): Promise<void> {
    this.maybeFail()
    const session = this.session(sessionId)
    const call = session.pending.get(toolCallId)
    if (!call) throw new RuntimeError(`No pending tool call ${toolCallId}`)
    session.pending.delete(toolCallId)
    this.emit(session, { kind: "tool_decision", toolCallId, decision })
    this.status(session, "running")
    setImmediate(() => {
      if (decision === "allow") return this.runTool(session, toolCallId, call.toolName)
      this.emit(session, {
        kind: "tool_result",
        toolCallId,
        output: "The user denied this action.",
        isError: true,
      })
      this.reply(session, `[Simulated] Understood, I will not use ${call.toolName}.`)
    })
  }

  async interrupt(sessionId: string): Promise<void> {
    this.maybeFail()
    const session = this.session(sessionId)
    session.pending.clear()
    this.status(session, "idle")
  }

  async listEvents(sessionId: string): Promise<RunEvent[]> {
    this.maybeFail()
    return [...this.session(sessionId).events]
  }

  async *streamEvents(sessionId: string, signal: AbortSignal): AsyncIterable<RunEvent> {
    const session = this.session(sessionId)
    const queue: RunEvent[] = []
    let wake: (() => void) | undefined
    const listener = (event: RunEvent) => {
      queue.push(event)
      wake?.()
    }
    session.listeners.add(listener)
    const onAbort = () => wake?.()
    signal.addEventListener("abort", onAbort)
    try {
      while (!signal.aborted) {
        const next = queue.shift()
        if (next) {
          yield next
          continue
        }
        await new Promise<void>((resolve) => (wake = resolve))
        wake = undefined
      }
    } finally {
      session.listeners.delete(listener)
      signal.removeEventListener("abort", onAbort)
    }
  }

  async getUsage(sessionId: string): Promise<RunUsage> {
    this.maybeFail()
    return { ...this.session(sessionId).usage }
  }
}
