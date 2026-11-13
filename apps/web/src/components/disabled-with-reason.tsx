import type * as React from "react"

import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * A disabled control that still says why.
 *
 * A disabled button receives no pointer or focus events, so a tooltip attached to it never
 * opens. The focusable wrapper takes the hover and the keyboard focus instead, and React Aria
 * links the tooltip to it as its accessible description.
 */
export function DisabledWithReason({
  reason,
  children,
  className,
}: {
  reason: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <TooltipTrigger delay={200}>
      <span tabIndex={0} className={className ?? "inline-flex rounded-lg"}>
        {children}
      </span>
      <Tooltip>{reason}</Tooltip>
    </TooltipTrigger>
  )
}
