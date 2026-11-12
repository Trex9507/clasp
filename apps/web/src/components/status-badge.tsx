import { AlertTriangle, Check, CircleDashed, Loader2, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * One visual vocabulary for status, used by tables and detail pages alike so a row's badge
 * and its detail page cannot look like different things.
 *
 * The shapes carry the meaning, not the colours: a spinner for work in flight, a warning
 * triangle for something waiting on you, a tick for done, a cross for failed, a dashed circle
 * for not started. Colour reinforces; it never encodes on its own.
 */
export type StatusTone = "idle" | "running" | "attention" | "success" | "failed"

type Appearance = {
  icon: LucideIcon
  /** Applied to the icon and text. */
  className: string
  spin?: boolean
}

const APPEARANCE: Record<StatusTone, Appearance> = {
  idle: { icon: CircleDashed, className: "text-muted-foreground" },
  running: { icon: Loader2, className: "text-sky-600 dark:text-sky-400", spin: true },
  attention: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  success: { icon: Check, className: "text-emerald-600 dark:text-emerald-400" },
  failed: { icon: X, className: "text-destructive" },
}

export function StatusIcon({ tone, className }: { tone: StatusTone; className?: string }) {
  const { icon: Icon, className: color, spin } = APPEARANCE[tone]
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4 shrink-0", color, spin && "animate-spin", className)}
    />
  )
}

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: StatusTone
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm whitespace-nowrap",
        APPEARANCE[tone].className,
        className,
      )}
    >
      <StatusIcon tone={tone} />
      <span>{label}</span>
    </span>
  )
}
