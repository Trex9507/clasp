import { FileQuestion } from "lucide-react"

import { EmptyState } from "@/components/states"
import { LinkButton } from "@/components/ui/button"

export function NotFound() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Page not found"
      description="That address does not match anything in Clasp."
    >
      <LinkButton href="/" variant="outline">
        Back to home
      </LinkButton>
    </EmptyState>
  )
}
