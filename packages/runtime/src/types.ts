import type { ActionPermission, Effort, RunEvent, RunUsage } from "@clasp/shared"

/** One MCP server an agent version uses, with the tools it may call. */
export interface McpServerSpec {
  /** Stable, unique per agent; derived from the Clasp connection ID. */
  name: string
  url: string
  tools: { name: string; permission: ActionPermission }[]
}

/** An action as the agent should understand it, for the instructions section. */
export interface ActionNote {
  toolName: string
  connectionName: string
  usageNote: string
}

/** One agent version, in the shape the runtime needs to host it. */
export interface AgentVersionSpec {
  /** Clasp IDs, recorded on the runtime agent so it can be traced back. */
  claspAgentId: string
  claspVersionId: string
  workspaceId: string
  name: string
  description: string
  systemPrompt: string
  /** BCP-47 code; the runtime is told to always answer in it. */
  language: string
  /** The provider's own model ID (ModelOption.providerModelId), e.g. "claude-sonnet-5-5". */
  providerModelId: string
  effort: Effort
  mcpServers: McpServerSpec[]
  actions: ActionNote[]
}

/** Where a Clasp agent lives in a runtime. Stored on agents.runtime_ref. */
export interface RuntimeAgentRef {
  provider: string
  agentId: string
  version: number
}

/** A workspace's credential store in a runtime. Stored in runtime_vaults. */
export interface RuntimeVaultRef {
  provider: string
  vaultId: string
}

/** A bearer token the runtime injects when an agent calls the MCP server at `url`. */
export interface McpCredential {
  url: string
  token: string
  /** Shown in the runtime's console; never the secret. */
  label: string
}

export interface StartSessionOptions {
  /** The runtime agent and the exact version to run (sessions pin to it). */
  agent: RuntimeAgentRef
  environmentId: string
  vaultIds: string[]
  /** Hard spending cap in US cents; the runtime pauses the session when it is reached. */
  budgetCents: number
  title: string
  metadata: Record<string, string>
}

/** The only way the platform reaches a model runtime (CLAUDE.md, rule 3). */
export interface AgentRuntime {
  readonly provider: string
  /** Creates the runtime agent when `ref` is undefined, otherwise updates it in place. */
  upsertAgent(spec: AgentVersionSpec, ref?: RuntimeAgentRef): Promise<RuntimeAgentRef>
  /** Permanently retires the runtime agent; running sessions finish, new ones cannot start. */
  archiveAgent(ref: RuntimeAgentRef): Promise<void>
  /** Returns the workspace's vault, creating it when `existing` is undefined. */
  ensureVault(workspaceId: string, existing?: RuntimeVaultRef): Promise<RuntimeVaultRef>
  /** Stores or replaces a credential; returns its runtime ID. */
  putCredential(
    vault: RuntimeVaultRef,
    credential: McpCredential,
    existingId?: string,
  ): Promise<string>
  deleteCredential(vault: RuntimeVaultRef, credentialId: string): Promise<void>

  /** Returns the environment sessions run in, creating it when `existing` is undefined. */
  ensureEnvironment(existing?: string): Promise<string>
  startSession(options: StartSessionOptions): Promise<{ sessionId: string }>
  sendMessage(sessionId: string, text: string): Promise<void>
  decideTool(
    sessionId: string,
    toolCallId: string,
    decision: "allow" | "deny",
    denyMessage?: string,
  ): Promise<void>
  interrupt(sessionId: string): Promise<void>
  /** The session's full history, oldest first. */
  listEvents(sessionId: string): Promise<RunEvent[]>
  /** Live events from the moment of the call; ends when `signal` aborts. No replay. */
  streamEvents(sessionId: string, signal: AbortSignal): AsyncIterable<RunEvent>
  /** Cumulative usage and list cost of the session. */
  getUsage(sessionId: string): Promise<RunUsage>
}

export class RuntimeError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = "RuntimeError"
  }
}
