"use client"

import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import {
  Checkbox as CheckboxPrimitive,
  type CheckboxProps as CheckboxPrimitiveProps,
} from "react-aria-components"

/**
 * A checkbox that takes its label as children, like `Radio`. RAC renders a real (visually
 * hidden) input, so it is labelled, focusable and form-friendly without extra wiring.
 */
function Checkbox({
  className,
  children,
  ...props
}: Omit<CheckboxPrimitiveProps, "className"> & { className?: string }) {
  return (
    <CheckboxPrimitive
      data-slot="checkbox"
      className={cn(
        "group/checkbox flex cursor-pointer items-start gap-2 text-sm outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {(renderProps) => (
        <>
          <span
            data-slot="checkbox-indicator"
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input text-primary-foreground transition-colors group-data-focus-visible/checkbox:ring-[3px] group-data-focus-visible/checkbox:ring-ring/50 group-data-invalid/checkbox:border-destructive group-data-selected/checkbox:border-primary group-data-selected/checkbox:bg-primary"
          >
            <CheckIcon
              aria-hidden="true"
              className="size-3 opacity-0 group-data-selected/checkbox:opacity-100"
            />
          </span>
          {children ? (
            <span className="min-w-0 flex-1">
              {typeof children === "function" ? children(renderProps) : children}
            </span>
          ) : null}
        </>
      )}
    </CheckboxPrimitive>
  )
}

export { Checkbox }
