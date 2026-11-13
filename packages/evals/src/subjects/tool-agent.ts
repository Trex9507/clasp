// Runs an agent the way Clasp configures it (the same system prompt, its actions as tools) through
// the Messages API, with the tools stubbed. Hosted agents cannot reach a local fixture server, and
// tools with side effects must never really fire, so evals grade the tool calls the agent makes.
import type Anthropic from "@anthropic-ai/sdk"
import { buildSystemPrompt } from "@clasp/runtime"
import type { ActionPermission, Effort } from "@clasp/shared"
import type { CostMeter } from "../cost.js"
import { CRM_TOOLS, type FixtureTool } from "../fixtures/crm.js"

export interface AgentAction {
  toolName: string
  permission: ActionPermission
  usageNote: string
}

export interface ToolAgentConfig {
  systemPrompt: string
  language: string
  effort: Effort
  actions: AgentAction[]
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
}

export interface ToolAgentOutput {
  reply: string
  toolCalls: ToolCall[]
  stopReason: string | null
  model: string
  /** Every request and response, so a failing case can be read end to end. */
  transcript: Anthropic.MessageParam[]
}

export interface ToolAgentOptions {
  model: string
  /** Replaces a tool's fixture result, to plant content (prompt injection) in it. */
  toolOutputs?: Record<string, string>
  maxTurns?: number
}

function toolsFor(actions: AgentAction[]): FixtureTool[] {
  return actions.map((a) => {
    const tool = CRM_TOOLS.find((t) => t.name === a.toolName)
    if (!tool) throw new Error(`No fixture tool named ${a.toolName}`)
    return tool
  })
}

export async function runToolAgent(
  client: Anthropic,
  meter: CostMeter,
  config: ToolAgentConfig,
  userMessage: string,
  options: ToolAgentOptions,
): Promise<ToolAgentOutput> {
  const fixtures = toolsFor(config.actions)
  // "Ask me first" pauses a hosted run until the user decides; the eval plays a user who approves,
  // so what is graded is whether the agent chose to call the tool at all.
  const system = buildSystemPrompt(
    config.systemPrompt,
    config.language,
    config.actions.map((a) => ({
      toolName: a.toolName,
      connectionName: "CRM",
      usageNote: a.usageNote,
    })),
  )
  const tools: Anthropic.Tool[] = fixtures.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }]
  const toolCalls: ToolCall[] = []
  let reply = ""
  let stopReason: string | null = null
  let model = options.model

  for (let turn = 0; turn < (options.maxTurns ?? 8); turn++) {
    meter.assertWithinBudget()
    const response = await client.messages.create({
      model: options.model,
      max_tokens: 16000,
      system,
      // A snapshot: the history keeps growing after this request is sent.
      messages: [...messages],
      ...(tools.length > 0 ? { tools } : {}),
      output_config: { effort: config.effort },
    })
    meter.record(options.model, response.usage)
    model = response.model
    if (!model.startsWith(options.model)) {
      // A substituted model would invalidate the comparison, so the case fails loudly.
      throw new Error(`Expected ${options.model} but ${model} answered`)
    }
    stopReason = response.stop_reason
    // Keep the full content (thinking blocks included) so the next turn is valid.
    messages.push({ role: "assistant", content: response.content })
    reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()

    const uses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    if (response.stop_reason !== "tool_use" || uses.length === 0) break

    const results: Anthropic.ToolResultBlockParam[] = uses.map((use) => {
      const input = (use.input ?? {}) as Record<string, unknown>
      toolCalls.push({ name: use.name, input })
      const fixture = fixtures.find((t) => t.name === use.name)
      const content = options.toolOutputs?.[use.name] ?? fixture?.run(input) ?? "Unknown tool."
      return { type: "tool_result", tool_use_id: use.id, content }
    })
    // All results of one turn go back in a single message.
    messages.push({ role: "user", content: results })
  }

  return { reply, toolCalls, stopReason, model, transcript: messages }
}
