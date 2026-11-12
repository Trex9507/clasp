import type { AgentStatus } from "@clasp/shared"
import { Archive, Bot, Plus } from "lucide-react"
import type { Key } from "react-aria-components"
import { useParams, useSearchParams } from "react-router"

import { PageHeader } from "@/components/page-header"
import { RelativeTime } from "@/components/relative-time"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState, ErrorState, LoadingRows } from "@/components/states"
import { LinkButton } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { workspacePath } from "@/lib/nav"
import { useAgents } from "@/lib/queries"
import { languageLabel, modelLabel, useModelCatalog } from "@/routes/agents/agent-labels"

/** The status filter lives in the URL so an archived view can be linked and survives reload. */
function readStatus(value: string | null): AgentStatus {
  return value === "archived" ? "archived" : "active"
}

export function AgentsPage() {
  const { workspaceId = "" } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = readStatus(searchParams.get("status"))
  const newHref = workspacePath(workspaceId, "agents/new")

  function selectStatus(key: Key) {
    const next = readStatus(String(key))
    setSearchParams(next === "active" ? {} : { status: next }, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Agents"
        description="Agents you build in this workspace. Clasp hosts and runs them."
        actions={
          <LinkButton href={newHref}>
            <Plus aria-hidden="true" />
            Create agent
          </LinkButton>
        }
      />
      <Tabs selectedKey={status} onSelectionChange={selectStatus}>
        <TabsList aria-label="Agent status">
          <TabsTrigger id="active">Active</TabsTrigger>
          <TabsTrigger id="archived">Archived</TabsTrigger>
        </TabsList>
        <TabsContent id="active" className="pt-2">
          <AgentTable workspaceId={workspaceId} status="active" newHref={newHref} />
        </TabsContent>
        <TabsContent id="archived" className="pt-2">
          <AgentTable workspaceId={workspaceId} status="archived" newHref={newHref} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function AgentTable({
  workspaceId,
  status,
  newHref,
}: {
  workspaceId: string
  status: AgentStatus
  newHref: string
}) {
  const agents = useAgents(workspaceId, status)
  const catalog = useModelCatalog()

  if (agents.isPending) return <LoadingRows />
  if (agents.isError) {
    return (
      <ErrorState
        error={agents.error}
        title="Could not load agents"
        onRetry={() => void agents.refetch()}
      />
    )
  }

  const rows = agents.data.agents
  if (rows.length === 0) {
    return status === "active" ? (
      <EmptyState
        icon={Bot}
        title="No agents yet"
        description="An agent has a system prompt, a model and actions it can take through your MCP connections."
      >
        <LinkButton href={newHref}>
          <Plus aria-hidden="true" />
          Create agent
        </LinkButton>
      </EmptyState>
    ) : (
      <EmptyState
        icon={Archive}
        title="No archived agents"
        description="Agents you archive show up here. Archiving stops an agent from being hosted."
      />
    )
  }

  return (
    <Table aria-label={status === "active" ? "Active agents" : "Archived agents"}>
      <TableHeader>
        <TableHead isRowHeader>Agent</TableHead>
        <TableHead>Model</TableHead>
        <TableHead>Language</TableHead>
        <TableHead>Version</TableHead>
        <TableHead>Actions</TableHead>
        <TableHead>Updated</TableHead>
      </TableHeader>
      <TableBody items={rows}>
        {(agent) => (
          <TableRow
            id={agent.id}
            href={workspacePath(workspaceId, `agents/${agent.id}`)}
            textValue={agent.name}
            className="cursor-pointer"
          >
            <TableCell className="max-w-md whitespace-normal">
              <div className="flex items-start gap-3">
                <AgentIcon icon={agent.icon} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{agent.name}</div>
                  {agent.description ? (
                    <div className="truncate text-muted-foreground">{agent.description}</div>
                  ) : null}
                </div>
              </div>
            </TableCell>
            <TableCell>{modelLabel(catalog, agent.model)}</TableCell>
            <TableCell>{languageLabel(agent.language)}</TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-2">
                <span className="tabular-nums">v{agent.version}</span>
                {agent.runtimeSynced ? null : (
                  <StatusBadge tone="attention" label="Not synced" className="text-xs" />
                )}
              </span>
            </TableCell>
            <TableCell className="tabular-nums">{agent.actionCount}</TableCell>
            <TableCell className="text-muted-foreground">
              <RelativeTime value={agent.updatedAt} />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

/** The agent's emoji, or a bot glyph when it has none, in a fixed square so rows align. */
export function AgentIcon({ icon, size = "sm" }: { icon: string; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-9 text-xl" : "size-8 text-base"
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-lg bg-muted ${box}`}
    >
      {icon || <Bot className="size-4 text-muted-foreground" />}
    </span>
  )
}
