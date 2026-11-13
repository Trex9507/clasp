import * as React from "react"
import { ArrowLeft } from "lucide-react"

import { LinkButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * One heading treatment for every page, so the eye lands in the same place
 * on each and "where am I" never costs a scan.
 *
 * `title` renders as the page's only `h1`. A view with two competing
 * headings is a view where a screen-reader user cannot tell which one is
 * the page.
 *
 * `back` is the way up a level, and it gets its own column in the gutter
 * left of the content rather than a place in the actions row, where a
 * plain "up one level" link would compete with the buttons that act on the
 * thing itself. The column is what keeps the heading intact: the arrow
 * neither indents the title nor sits above it, so the title still starts
 * on the page's own left edge, level with every card below it.
 *
 * The gutter only exists once the window is wide enough to have one. `xl`
 * is measured, not guessed: at 1280px the sidebar takes 16rem and `main`
 * 1.5rem of padding, leaving 976px around a 56rem column - 40px spare each
 * side, plus that padding to hang in, against the 48px the arrow needs.
 * Below it the arrow falls back into the row, which is the phone
 * convention anyway. It carries a label for screen readers because an
 * arrow on its own says nothing about where it goes.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
  className?: string
}) {
  return (
    <div className={cn("mb-5 flex items-start gap-2 xl:gap-4", className)}>
      {back ? (
        <LinkButton
          href={back.href}
          aria-label={back.label}
          variant="ghost"
          size="icon-sm"
          // The pull is exactly the arrow's own width plus the gap
          // (2rem + 1rem), so the content beside it lands back on the
          // container's left edge rather than near it. Change one of the
          // three and change all three. `mt-0.5` puts the arrow on the
          // h1's optical centre, not its box.
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground xl:-ml-12"
        >
          <ArrowLeft aria-hidden="true" />
        </LinkButton>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {/* Wraps below the title on narrow screens rather than shrinking the
            heading - a truncated page title is worse than a second row. */}
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
