import * as React from "react"
import { useNavigate, useParams } from "react-router"

import { PageHeader } from "@/components/page-header"
import { workspacePath } from "@/lib/nav"
import { useCreateAgent } from "@/lib/queries"
import { AgentForm } from "@/routes/agents/agent-form"
import { emptyAgentForm } from "@/routes/agents/agent-form-schema"

export function CreateAgentPage() {
  const { workspaceId = "" } = useParams()
  const navigate = useNavigate()
  const create = useCreateAgent(workspaceId)
  const listHref = workspacePath(workspaceId)
  // Computed once: a new object each render would look like new defaults to the form.
  const [defaultValues] = React.useState(emptyAgentForm)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Create agent"
        description="Give it a name, instructions and a model. You can change all of it later."
        back={{ href: listHref, label: "Back to agents" }}
      />
      <AgentForm
        defaultValues={defaultValues}
        submitLabel="Create agent"
        isPending={create.isPending}
        error={create.error}
        cancelHref={listHref}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (agent) => void navigate(workspacePath(workspaceId, `agents/${agent.id}`)),
          })
        }
      />
    </div>
  )
}
