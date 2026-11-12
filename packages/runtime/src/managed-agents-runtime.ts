import Anthropic from "@anthropic-ai/sdk"
import type { RunEvent, RunUsage } from "@clasp/shared"
import { buildSystemPrompt } from "./system-prompt.js"
import {
  toRunEvent,
  toRunUsage,
  type SessionEventLike,
  type UsageLike,
} from "./managed-agents-events.js"
import {
  RuntimeError,
  type AgentRuntime,
  type AgentVersionSpec,
  type McpCredential,
  type RuntimeAgentRef,
  type RuntimeVaultRef,
  type StartSessionOptions,
} from "./types.js"

export interface ManagedAgentsRuntimeOptions {
  /** Injectable for tests; otherwise built from the environment (ANTHROPIC_API_KEY or a profile). */
  client?: Anthropic
  apiKey?: string
}

/**
 * Hosts Clasp agents on Claude Managed Agents. Clasp agents are created by users at runtime, so
 * runtime agents are provisioned in code when an agent version is saved (never per run): each
 * Clasp agent maps to one Managed Agents agent, updated in place so its versions line up.
 */
export class ManagedAgentsRuntime implements AgentRuntime {
  readonly provider = "anthropic-managed-agents"
  private readonly client: Anthropic

  constructor(options: ManagedAgentsRuntimeOptions = {}) {
    this.client = options.client ?? new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {})
  }

  private params(spec: AgentVersionSpec) {
    return {
      name: spec.name,
      description: spec.description || null,
      model: { id: spec.providerModelId, effort: spec.effort },
      system: buildSystemPrompt(spec.systemPrompt, spec.language, spec.actions),
      // Sent even when empty, so removing the last action clears them on update.
      mcp_servers: spec.mcpServers.map((s) => ({ type: "url" as const, name: s.name, url: s.url })),
      // Allowlist: every tool is off unless it is one of the agent's actions.
      tools: spec.mcpServers.map((s) => ({
        type: "mcp_toolset" as const,
        mcp_server_name: s.name,
        default_config: { enabled: false },
        configs: s.tools.map((t) => ({
          name: t.name,
          enabled: true,
          permission_policy: {
            type: t.permission === "auto" ? ("always_allow" as const) : ("always_ask" as const),
          },
        })),
      })),
      metadata: {
        clasp_agent_id: spec.claspAgentId,
        clasp_version_id: spec.claspVersionId,
        clasp_workspace_id: spec.workspaceId,
      },
    }
  }

  async upsertAgent(spec: AgentVersionSpec, ref?: RuntimeAgentRef): Promise<RuntimeAgentRef> {
    try {
      const agent = ref
        ? // No `version` precondition: Clasp's database is the source of truth and owns this
          // agent, so the newest Clasp version always wins.
          await this.client.beta.agents.update(ref.agentId, this.params(spec))
        : await this.client.beta.agents.create(this.params(spec))
      return { provider: this.provider, agentId: agent.id, version: agent.version }
    } catch (error) {
      throw new RuntimeError(
        `Managed Agents ${ref ? "update" : "create"} failed: ${describe(error)}`,
        error,
      )
    }
  }

  async archiveAgent(ref: RuntimeAgentRef): Promise<void> {
    try {
      await this.client.beta.agents.archive(ref.agentId)
    } catch (error) {
      if (error instanceof Anthropic.NotFoundError) return
      throw new RuntimeError(`Managed Agents archive failed: ${describe(error)}`, error)
    }
  }

  async ensureVault(workspaceId: string, existing?: RuntimeVaultRef): Promise<RuntimeVaultRef> {
    if (existing) return existing
    try {
      const vault = await this.client.beta.vaults.create({
        display_name: `Clasp workspace ${workspaceId}`,
        metadata: { clasp_workspace_id: workspaceId },
      })
      return { provider: this.provider, vaultId: vault.id }
    } catch (error) {
      throw new RuntimeError(`Managed Agents vault create failed: ${describe(error)}`, error)
    }
  }

  async putCredential(
    vault: RuntimeVaultRef,
    credential: McpCredential,
    existingId?: string,
  ): Promise<string> {
    try {
      // A credential is keyed by its server URL, which cannot be updated in place: replace it.
      if (existingId) await this.deleteCredential(vault, existingId)
      const created = await this.client.beta.vaults.credentials.create(vault.vaultId, {
        display_name: credential.label,
        auth: { type: "static_bearer", mcp_server_url: credential.url, token: credential.token },
      })
      return created.id
    } catch (error) {
      if (error instanceof RuntimeError) throw error
      throw new RuntimeError(`Managed Agents credential save failed: ${describe(error)}`, error)
    }
  }

  async deleteCredential(vault: RuntimeVaultRef, credentialId: string): Promise<void> {
    try {
      await this.client.beta.vaults.credentials.delete(credentialId, { vault_id: vault.vaultId })
    } catch (error) {
      if (error instanceof Anthropic.NotFoundError) return
      throw new RuntimeError(`Managed Agents credential delete failed: ${describe(error)}`, error)
    }
  }

  async ensureEnvironment(existing?: string): Promise<string> {
    if (existing) return existing
    return this.call("environment create", async () => {
      const env = await this.client.beta.environments.create({
        name: "clasp-agents",
        // Agents get no sandbox tools, only MCP actions: deny other egress.
        config: { type: "cloud", networking: { type: "limited", allow_mcp_servers: true } },
      })
      return env.id
    })
  }

  async startSession(options: StartSessionOptions): Promise<{ sessionId: string }> {
    return this.call("session create", async () => {
      const session = await this.client.beta.sessions.create({
        agent: { type: "agent", id: options.agent.agentId, version: options.agent.version },
        environment_id: options.environmentId,
        vault_ids: options.vaultIds,
        budget: {
          type: "limit",
          max_list_cost: { amount: String(options.budgetCents), currency: "USD" },
        },
        title: options.title,
        metadata: options.metadata,
      })
      return { sessionId: session.id }
    })
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    await this.call("send message", () =>
      this.client.beta.sessions.events.send(sessionId, {
        events: [{ type: "user.message", content: [{ type: "text", text }] }],
      }),
    )
  }

  async decideTool(
    sessionId: string,
    toolCallId: string,
    decision: "allow" | "deny",
    denyMessage?: string,
  ): Promise<void> {
    await this.call("tool decision", () =>
      this.client.beta.sessions.events.send(sessionId, {
        events: [
          {
            type: "user.tool_confirmation",
            tool_use_id: toolCallId,
            result: decision,
            ...(decision === "deny" && denyMessage ? { deny_message: denyMessage } : {}),
          },
        ],
      }),
    )
  }

  async interrupt(sessionId: string): Promise<void> {
    await this.call("interrupt", () =>
      this.client.beta.sessions.events.send(sessionId, { events: [{ type: "user.interrupt" }] }),
    )
  }

  async listEvents(sessionId: string): Promise<RunEvent[]> {
    return this.call("list events", async () => {
      const events: RunEvent[] = []
      for await (const event of this.client.beta.sessions.events.list(sessionId)) {
        const mapped = toRunEvent(event as unknown as SessionEventLike)
        if (mapped) events.push(mapped)
      }
      return events
    })
  }

  async *streamEvents(sessionId: string, signal: AbortSignal): AsyncIterable<RunEvent> {
    const stream = await this.call("open stream", () =>
      this.client.beta.sessions.events.stream(sessionId, {}, { signal }),
    )
    try {
      for await (const event of stream) {
        const mapped = toRunEvent(event as unknown as SessionEventLike)
        if (mapped) yield mapped
      }
    } catch (error) {
      if (signal.aborted) return
      throw new RuntimeError(`Managed Agents stream failed: ${describe(error)}`, error)
    }
  }

  async getUsage(sessionId: string): Promise<RunUsage> {
    return this.call("session retrieve", async () => {
      const session = await this.client.beta.sessions.retrieve(sessionId)
      return toRunUsage(session.usage as unknown as UsageLike)
    })
  }

  private async call<T>(what: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      throw new RuntimeError(`Managed Agents ${what} failed: ${describe(error)}`, error)
    }
  }
}

function describe(error: unknown): string {
  if (error instanceof Anthropic.APIError) return `${error.status ?? "network"} ${error.message}`
  return error instanceof Error ? error.message : String(error)
}
