import type { RunEvent, RunStatus, RunUsage } from "@clasp/shared"

import type { StatusTone } from "@/components/status-badge"

const RUN_STATUS: Record<RunStatus, { tone: StatusTone; label: string }> = {
  running: { tone: "running", label: "Working" },
  idle: { tone: "idle", label: "Ready" },
  awaiting_approval: { tone: "attention", label: "Needs your approval" },
  budget_reached: { tone: "attention", label: "Spending cap reached" },
  ended: { tone: "idle", label: "Ended" },
  error: { tone: "failed", label: "Failed" },
}

export function runStatusAppearance(status: RunStatus): { tone: StatusTone; label: string } {
  return RUN_STATUS[status]
}

/** Statuses in which the run takes no new message. */
export function isClosed(status: RunStatus | undefined): boolean {
  return status === "budget_reached" || status === "ended" || status === "error"
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const count = new Intl.NumberFormat("en-US")

/** US cents as dollars: 4 becomes "$0.04". */
export function formatCents(cents: number): string {
  return usd.format(cents / 100)
}

export function formatTokens(usage: RunUsage): string {
  return `${count.format(usage.inputTokens)} in / ${count.format(usage.outputTokens)} out tokens`
}

type ToolCallEvent = Extract<RunEvent, { kind: "tool_call" }>

const TOOL_PERMISSION: Record<ToolCallEvent["permission"], string> = {
  allow: "Runs automatically",
  ask: "Ask me first",
  deny: "Blocked",
}

export function toolPermissionLabel(permission: ToolCallEvent["permission"]): string {
  return TOOL_PERMISSION[permission]
}
