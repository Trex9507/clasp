// Runs an agent through the AgentRuntime, the production path: the runtime hosts it with the
// system prompt Clasp builds, and the eval chats with it in a session like the Playground does.
import type { AgentRuntime, AgentVersionSpec, RuntimeAgentRef } from "@clasp/runtime"
import type { Effort, RunEvent } from "@clasp/shared"
import type { CostMeter } from "../cost.js"

export interface HostedAgentConfig {
  systemPrompt: string
  language: string
  effort: Effort
}

export interface HostedAgentOutput {
  reply: string
  events: RunEvent[]
  status: string
}

/** Creates (once per distinct config) and archives the runtime agents an eval suite uses. */
export class HostedAgents {
  private readonly refs = new Map<string, Promise<RuntimeAgentRef>>()
  private environment: Promise<string> | undefined

  constructor(
    private readonly runtime: AgentRuntime,
    private readonly model: string,
  ) {}

  private agentFor(config: HostedAgentConfig): Promise<RuntimeAgentRef> {
    const key = JSON.stringify(config)
    let ref = this.refs.get(key)
    if (!ref) {
      const spec: AgentVersionSpec = {
        claspAgentId: "eval",
        claspVersionId: "eval",
        workspaceId: "eval",
        name: `Clasp eval (${config.language})`,
        description: "Created by packages/evals; archived when the run ends.",
        systemPrompt: config.systemPrompt,
        language: config.language,
        providerModelId: this.model,
        effort: config.effort,
        mcpServers: [],
        actions: [],
      }
      ref = this.runtime.upsertAgent(spec)
      this.refs.set(key, ref)
    }
    return ref
  }

  async run(
    meter: CostMeter,
    config: HostedAgentConfig,
    message: string,
    timeoutMs = 120_000,
  ): Promise<HostedAgentOutput> {
    meter.assertWithinBudget()
    this.environment ??= this.runtime.ensureEnvironment()
    const [agent, environmentId] = await Promise.all([this.agentFor(config), this.environment])
    const { sessionId } = await this.runtime.startSession({
      agent,
      environmentId,
      vaultIds: [],
      budgetCents: 50,
      title: "Clasp eval",
      metadata: { clasp_eval: "true" },
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const events: RunEvent[] = []
    let status = "running"
    try {
      // Open the stream before sending, so no early event is missed.
      const stream = this.runtime.streamEvents(sessionId, controller.signal)[Symbol.asyncIterator]()
      let next = stream.next()
      await this.runtime.sendMessage(sessionId, message)
      let sawRunning = false
      while (!controller.signal.aborted) {
        const item = await next
        if (item.done) break
        next = stream.next()
        events.push(item.value)
        if (item.value.kind !== "status") continue
        if (item.value.status === "running") sawRunning = true
        if (sawRunning && item.value.status !== "running") {
          status = item.value.status
          break
        }
      }
      // Abort before return(): a generator awaiting the next event only finishes once woken.
      controller.abort()
      await stream.return?.(undefined)
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
    if (status === "running") status = "timeout"
    const usage = await this.runtime.getUsage(sessionId)
    meter.addUsd(usage.costCents / 100)

    const reply = events
      .filter((e): e is Extract<RunEvent, { kind: "agent_message" }> => e.kind === "agent_message")
      .map((e) => e.text)
      .join("\n")
      .trim()
    return { reply, events, status }
  }

  /** Archives every agent this run created; runtime agents are not left behind. */
  async cleanup(): Promise<void> {
    for (const ref of this.refs.values()) {
      await this.runtime.archiveAgent(await ref).catch(() => undefined)
    }
  }
}
