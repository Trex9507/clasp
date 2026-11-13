import type { Effort } from "@clasp/shared"

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
}

/** Where a Clasp agent version lives in a runtime. Stored on agent_versions.runtime_ref. */
export interface RuntimeAgentRef {
  provider: string
  agentId: string
  version: number
}

/**
 * The only way the platform reaches a model runtime (CLAUDE.md, rule 3). Session methods arrive
 * with the playground (milestone B4) and credential sync with MCP connections (milestone B3).
 */
export interface AgentRuntime {
  readonly provider: string
  /** Creates the runtime agent when `ref` is undefined, otherwise updates it in place. */
  upsertAgent(spec: AgentVersionSpec, ref?: RuntimeAgentRef): Promise<RuntimeAgentRef>
  /** Permanently retires the runtime agent; running sessions finish, new ones cannot start. */
  archiveAgent(ref: RuntimeAgentRef): Promise<void>
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
