import { Bot, Plus } from "lucide-react"

import { DisabledWithReason } from "@/components/disabled-with-reason"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"

export function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Agents"
        description="Agents you build in this workspace. Clasp hosts and runs them."
        actions={
          <DisabledWithReason reason="Coming in the next milestone">
            <Button isDisabled>
              <Plus aria-hidden="true" />
              Create agent
            </Button>
          </DisabledWithReason>
        }
      />
      <EmptyState
        icon={Bot}
        title="No agents yet"
        description="An agent has a system prompt, a model and actions it can take through your MCP connections."
      />
    </>
  )
}
