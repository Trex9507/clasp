import * as React from "react"
import { cn } from "cn"
import { composeRenderProps, TextArea as TextareaPrimitive } from "react-aria-components"

/**
 * `field-sizing-content` grows the box with what is typed, which is right
 * for a line or two and wrong without a ceiling: a pasted long text grew
 * the field past the bottom of the window, taking the dialog's own footer
 * with it, and a `fixed` modal has nothing to scroll to get it back.
 *
 * So the growth is capped here rather than at each call site - the cap
 * belongs with the utility that causes the growth, and every textarea in
 * this app sits in a dialog or a card where growing without bound is
 * wrong. Past the cap the field scrolls its own content, which is the
 * ordinary textarea behaviour people already expect.
 *
 * `min(50vh, 24rem)` is a pair with a reason each: 24rem keeps a tall
 * window from handing one field half the screen, and 50vh keeps a short
 * one from spending its whole height on the field and hiding the buttons
 * below it. A call site that genuinely needs a different ceiling passes
 * its own `max-h-*`, which wins - `cn` resolves the conflict.
 */
function Textarea({ className, ...props }: React.ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      className={composeRenderProps(className, (className) =>
        cn(
          "flex field-sizing-content max-h-[min(50vh,24rem)] min-h-16 w-full overflow-y-auto rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className,
        ),
      )}
      {...props}
    />
  )
}

export { Textarea }
