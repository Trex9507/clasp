import { Plug, Plus } from "lucide-react"

import { DisabledWithReason } from "@/components/disabled-with-reason"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/states"
import { Button } from "@/components/ui/button"

export function ConnectionsPage() {
  return (
    <>
      <PageHeader
        title="Connections"
        description="MCP servers connected to this workspace."
        actions={
          <DisabledWithReason reason="Coming in the next milestone">
            <Button isDisabled>
              <Plus aria-hidden="true" />
              Add connection
            </Button>
          </DisabledWithReason>
        }
      />
      <EmptyState
        icon={Plug}
        title="No connections yet"
        description="Connect an MCP server and the tools it exposes become actions your agents can take."
      />
    </>
  )
}
