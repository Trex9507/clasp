// Normalizes Managed Agents session events into Clasp's RunEvent shape. Events the playground
// does not show (spans, thread bookkeeping, previews) map to undefined and are dropped.
import type { RunEvent, RunStatus, RunUsage } from "@clasp/shared"

interface Block {
  type: string
  text?: string
}

/** A session event as the SDK delivers it; only the fields read here are typed. */
export interface SessionEventLike {
  id?: string
  type: string
  processed_at?: string | null
  content?: Block[]
  name?: string
  mcp_server_name?: string
  input?: Record<string, unknown>
  evaluated_permission?: string
  mcp_tool_use_id?: string
  is_error?: boolean | null
  tool_use_id?: string
  result?: string
  stop_reason?: { type: string; event_ids?: string[] } | null
  error?: { type?: string; message?: string } | null
  usage?: UsageLike | null
}

export interface UsageLike {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: Record<string, number | undefined> | null
  list_cost?: { amount: string; currency: string } | null
}

function text(blocks: Block[] | undefined): string {
  return (blocks ?? [])
    .map((b) => (b.type === "text" ? (b.text ?? "") : `[${b.type}]`))
    .join("\n")
    .trim()
}

export function toRunUsage(usage: UsageLike | null | undefined): RunUsage {
  const cacheCreation = Object.values(usage?.cache_creation ?? {}).reduce<number>(
    (sum, n) => sum + (n ?? 0),
    0,
  )
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: cacheCreation,
    costCents: Number.parseInt(usage?.list_cost?.amount ?? "0", 10) || 0,
  }
}

function idleStatus(stopReason: string | undefined): RunStatus {
  switch (stopReason) {
    case "requires_action":
      return "awaiting_approval"
    case "budget_reached":
      return "budget_reached"
    case "retries_exhausted":
      return "error"
    default:
      return "idle"
  }
}

export function toRunEvent(event: SessionEventLike): RunEvent | undefined {
  if (!event.id) return undefined
  const base = { id: event.id, at: event.processed_at ?? new Date().toISOString() }
  switch (event.type) {
    case "user.message":
      return { ...base, kind: "user_message", text: text(event.content) }
    case "agent.message":
      return { ...base, kind: "agent_message", text: text(event.content) }
    case "agent.thinking":
      return { ...base, kind: "thinking" }
    case "agent.mcp_tool_use": {
      const permission = event.evaluated_permission
      return {
        ...base,
        kind: "tool_call",
        toolName: event.name ?? "unknown",
        connectionName: event.mcp_server_name ?? "",
        input: event.input ?? {},
        permission: permission === "ask" || permission === "deny" ? permission : "allow",
      }
    }
    case "agent.mcp_tool_result":
      return {
        ...base,
        kind: "tool_result",
        toolCallId: event.mcp_tool_use_id ?? "",
        output: text(event.content),
        isError: event.is_error === true,
      }
    case "user.tool_confirmation":
      return {
        ...base,
        kind: "tool_decision",
        toolCallId: event.tool_use_id ?? "",
        decision: event.result === "deny" ? "deny" : "allow",
      }
    case "session.status_running":
    case "session.status_rescheduled":
      return { ...base, kind: "status", status: "running", pendingToolCallIds: [] }
    case "session.status_idle": {
      const status = idleStatus(event.stop_reason?.type)
      return {
        ...base,
        kind: "status",
        status,
        pendingToolCallIds:
          status === "awaiting_approval" ? (event.stop_reason?.event_ids ?? []) : [],
      }
    }
    case "session.status_terminated":
      return { ...base, kind: "status", status: "ended", pendingToolCallIds: [] }
    case "session.usage":
      return { ...base, kind: "usage", usage: toRunUsage(event.usage) }
    case "session.error":
      return {
        ...base,
        kind: "error",
        message: event.error?.message ?? event.error?.type ?? "The agent hit an error",
      }
    default:
      return undefined
  }
}
