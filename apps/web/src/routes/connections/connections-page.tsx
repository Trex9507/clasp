import type { McpConnection } from "@clasp/shared"
import {
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import * as React from "react"
import { useParams } from "react-router"

import { ConfirmDestructive } from "@/components/confirm-destructive"
import { PageHeader } from "@/components/page-header"
import { RelativeTime } from "@/components/relative-time"
import { EmptyState, ErrorState, LoadingRows } from "@/components/states"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"
import { useConnections, useDeleteConnection, useDiscoverConnection } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { ConnectionDialog } from "@/routes/connections/connection-dialog"
import { authLabel, countLabel } from "@/routes/connections/connection-labels"
import { ConnectionStatusBadge } from "@/routes/connections/connection-status-badge"
import { ToolInputs } from "@/routes/connections/tool-inputs"

/** What the add/edit dialog shows. Kept after closing so the exit animation keeps its content. */
type DialogState = { open: boolean; connection?: McpConnection }

export function ConnectionsPage() {
  const { workspaceId = "" } = useParams()
  const connections = useConnections(workspaceId)
  const discover = useDiscoverConnection(workspaceId)
  const remove = useDeleteConnection(workspaceId)
  const [dialog, setDialog] = React.useState<DialogState>({ open: false })
  // Hoisted to the page (see ConfirmDestructive): each card only says which one is pending.
  const [deleting, setDeleting] = React.useState<McpConnection | null>(null)

  const openAdd = () => setDialog({ open: true })

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Connections"
        description="MCP servers connected to this workspace. Their tools become actions your agents can take."
        actions={
          <Button onPress={openAdd}>
            <Plus aria-hidden="true" />
            Add connection
          </Button>
        }
      />

      {connections.isPending ? (
        <LoadingRows rows={3} />
      ) : connections.isError ? (
        <ErrorState
          error={connections.error}
          title="Could not load connections"
          onRetry={() => void connections.refetch()}
        />
      ) : connections.data.connections.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No connections yet"
          description="Connect an MCP server and the tools it exposes become actions your agents can take."
        >
          <Button onPress={openAdd}>
            <Plus aria-hidden="true" />
            Add connection
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-4" aria-label="Connections">
          {connections.data.connections.map((connection) => (
            <li key={connection.id}>
              <ConnectionCard
                connection={connection}
                isDiscovering={discover.isPending && discover.variables === connection.id}
                onDiscover={() => discover.mutate(connection.id)}
                onEdit={() => setDialog({ open: true, connection })}
                onDelete={() => setDeleting(connection)}
              />
            </li>
          ))}
        </ul>
      )}

      <ConnectionDialog
        // A fresh form per target, so editing one connection never shows another's values.
        key={dialog.connection?.id ?? "new"}
        workspaceId={workspaceId}
        connection={dialog.connection}
        isOpen={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
      />

      <ConfirmDestructive
        isOpen={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? "connection"}?`}
        description={
          deleting && deleting.usedBy.length > 0
            ? `It is used by ${deleting.usedBy.map((agent) => agent.name).join(", ")}. Remove its actions from those agents first.`
            : "Its tools stop being available as actions. Past agent versions keep their record of them."
        }
        confirmLabel="Delete connection"
        confirmPhrase={deleting?.name}
        isPending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id)
        }}
      />
    </div>
  )
}

function ConnectionCard({
  connection,
  isDiscovering,
  onDiscover,
  onEdit,
  onDelete,
}: {
  connection: McpConnection
  isDiscovering: boolean
  onDiscover: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [showTools, setShowTools] = React.useState(false)
  const toolsId = `connection-${connection.id}-tools`
  const toolCount = connection.tools.length

  return (
    <Card aria-label={connection.name} role="group">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="truncate">{connection.name}</h2>
          <ConnectionStatusBadge status={connection.status} />
        </CardTitle>
        <CardDescription className="truncate font-mono text-xs" title={connection.url}>
          {connection.url}
        </CardDescription>
        <CardAction className="flex gap-2">
          <Button variant="outline" size="sm" isPending={isDiscovering} onPress={onDiscover}>
            <RefreshCw aria-hidden="true" />
            Test & discover
          </Button>
          <DropdownMenuTrigger>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`More actions for ${connection.name}`}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
            <DropdownMenu placement="bottom end" className="w-44">
              <DropdownMenuItem onAction={onEdit}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onAction={onDelete}>
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenu>
          </DropdownMenuTrigger>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <div>
            <dt className="sr-only">Authentication</dt>
            <dd>{authLabel(connection.authType)}</dd>
          </div>
          <div>
            <dt className="sr-only">Tools</dt>
            <dd>{countLabel(toolCount, "tool")}</dd>
          </div>
          <div>
            <dt className="sr-only">Agents</dt>
            <dd>
              <UsedBy agents={connection.usedBy} />
            </dd>
          </div>
          <div>
            <dt className="sr-only">Last checked</dt>
            <dd>
              {connection.lastCheckedAt ? (
                <>
                  Checked <RelativeTime value={connection.lastCheckedAt} />
                </>
              ) : (
                "Never checked"
              )}
            </dd>
          </div>
        </dl>

        {connection.status === "error" && connection.lastError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{connection.lastError}</span>
          </div>
        ) : null}

        {toolCount > 0 ? (
          <div>
            <button
              type="button"
              aria-expanded={showTools}
              aria-controls={toolsId}
              onClick={() => setShowTools((value) => !value)}
              className="inline-flex items-center gap-1 rounded-md text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn("size-4 transition-transform", showTools && "rotate-90")}
              />
              {showTools ? "Hide tools" : "Show tools"}
            </button>
            {showTools ? (
              <ul
                id={toolsId}
                aria-label={`Tools of ${connection.name}`}
                className="mt-2 divide-y rounded-lg border"
              >
                {connection.tools.map((tool) => (
                  <li key={tool.name} className="grid gap-1 px-3 py-2">
                    <span className="font-mono text-sm">{tool.name}</span>
                    {tool.title ? <span className="text-sm font-medium">{tool.title}</span> : null}
                    {tool.description ? (
                      <span className="text-sm text-muted-foreground">{tool.description}</span>
                    ) : null}
                    <ToolInputs tool={tool} idPrefix={`${connection.id}-${tool.name}`} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function UsedBy({ agents }: { agents: McpConnection["usedBy"] }) {
  if (agents.length === 0) return <>Not used by any agent</>
  const label = `Used by ${countLabel(agents.length, "agent")}`
  return (
    <TooltipTrigger delay={200}>
      <span
        tabIndex={0}
        className="rounded underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {label}
      </span>
      <Tooltip>{agents.map((agent) => agent.name).join(", ")}</Tooltip>
    </TooltipTrigger>
  )
}
