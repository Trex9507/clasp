import { TriangleAlert } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { errorDetail } from "@/lib/api-client"

/**
 * The three states every data view has to render, in one place.
 *
 * Written once because they are the surfaces most likely to be skipped under
 * time pressure. An empty list and a failed fetch that both render as a blank
 * rectangle are indistinguishable, and the difference between "nothing here
 * yet" and "we could not reach the API" is the whole question.
 */

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  title = "Could not load this",
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  return (
    // role="alert" so the failure is announced rather than silently
    // replacing a skeleton for anyone not watching that region.
    <div role="alert">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert className="text-destructive" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{errorDetail(error)}</EmptyDescription>
        </EmptyHeader>
        {onRetry ? (
          <EmptyContent>
            <Button variant="outline" onPress={onRetry}>
              Try again
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  )
}

/** A whole-page wait, for the moments before the app knows who you are. */
export function LoadingPage({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-48 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  )
}
