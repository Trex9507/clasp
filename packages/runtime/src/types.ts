import type { ActionPermission, Effort } from "@clasp/shared"

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

/**
 * The only way the platform reaches a model runtime (CLAUDE.md, rule 3). Session methods arrive
 * with the playground (milestone B4).
 */
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
