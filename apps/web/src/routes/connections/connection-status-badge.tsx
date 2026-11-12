import type { McpConnectionStatus } from "@clasp/shared"

import { StatusBadge, type StatusTone } from "@/components/status-badge"

const STATUS: Record<McpConnectionStatus, { tone: StatusTone; label: string }> = {
  ok: { tone: "success", label: "Connected" },
  error: { tone: "failed", label: "Error" },
  unchecked: { tone: "idle", label: "Not checked" },
}

export function ConnectionStatusBadge({ status }: { status: McpConnectionStatus }) {
  const { tone, label } = STATUS[status]
  return <StatusBadge tone={tone} label={label} />
}
