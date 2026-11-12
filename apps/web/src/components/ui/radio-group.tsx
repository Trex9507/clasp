"use client"

import { cn } from "cn"
import {
  Radio as RadioPrimitive,
  RadioGroup as RadioGroupPrimitive,
  type RadioGroupProps as RadioGroupPrimitiveProps,
  type RadioProps as RadioPrimitiveProps,
} from "react-aria-components"

/**
 * A group of mutually exclusive choices.
 *
 * `Radio` renders its own indicator and takes the label as children, so a
 * caller writes the choice once. RAC owns arrow-key navigation and the
 * roving tab stop, which is the behaviour people expect from radios and the
 * reason this wraps the primitive rather than styling bare inputs.
 */
function RadioGroup({ className, ...props }: RadioGroupPrimitiveProps) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function Radio({ className, children, ...props }: RadioPrimitiveProps) {
  return (
    <RadioPrimitive
      data-slot="radio"
      className={cn(
        // items-start, not items-center: an option here is frequently a
        // full sentence that wraps, and centring puts the dot beside the
        // middle of the text rather than beside its first line.
        "group/radio flex cursor-pointer items-start gap-2 text-sm outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {(renderProps) => (
        <>
          <span
            data-slot="radio-indicator"
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input transition-colors group-data-focus-visible/radio:ring-[3px] group-data-focus-visible/radio:ring-ring/50 group-data-invalid/radio:border-destructive group-data-selected/radio:border-primary"
          >
            <span className="size-2 rounded-full bg-primary opacity-0 transition-opacity group-data-selected/radio:opacity-100" />
          </span>
          <span className="min-w-0 flex-1">
            {typeof children === "function" ? children(renderProps) : children}
          </span>
        </>
      )}
    </RadioPrimitive>
  )
}

export { Radio, RadioGroup }
