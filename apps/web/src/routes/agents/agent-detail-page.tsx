import type { Agent, AgentVersion } from "@clasp/shared"
import {
  Archive,
  ChevronRight,
  FileQuestion,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import * as React from "react"
import type { Key } from "react-aria-components"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { z } from "zod"

import { ConfirmDestructive } from "@/components/confirm-destructive"
import { PageHeader } from "@/components/page-header"
import { RelativeTime } from "@/components/relative-time"
import { EmptyState, ErrorState, LoadingPage, LoadingRows } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button, LinkButton } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { errorStatus } from "@/lib/api-client"
import { workspacePath } from "@/lib/nav"
import {
  useAgent,
  useAgentVersions,
  useArchiveAgent,
  useSyncAgent,
  useUpdateAgent,
} from "@/lib/queries"
import { cn } from "@/lib/utils"
import { ActionsTab } from "@/routes/agents/actions-tab"
import { AgentForm } from "@/routes/agents/agent-form"
import { agentToForm } from "@/routes/agents/agent-form-schema"
import {
  effortLabel,
  languageLabel,
  modelLabel,
  permissionLabel,
  useModelCatalog,
} from "@/routes/agents/agent-labels"
import { AgentIcon } from "@/routes/agents/agents-page"

const TABS = ["configuration", "actions", "playground", "versions"] as const
type Tab = (typeof TABS)[number]

function readTab(value: string | null): Tab {
  return TABS.find((tab) => tab === value) ?? "configuration"
}

const AgentId = z.uuid()

export function AgentDetailPage() {
  const { workspaceId = "", agentId = "" } = useParams()
  // An id that is not a UUID cannot name an agent: answer "not found" without asking the API.
  const validId = AgentId.safeParse(agentId).success
  const agent = useAgent(workspaceId, agentId, validId)
  const listHref = workspacePath(workspaceId)

  if (!validId || (agent.isError && errorStatus(agent.error) === 404)) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Agent not found"
        description="This agent does not exist in this workspace."
      >
        <LinkButton href={listHref} variant="outline">
          Back to agents
        </LinkButton>
      </EmptyState>
    )
  }
  if (agent.isPending) return <LoadingPage />
  if (agent.isError) {
    return (
      <ErrorState
        error={agent.error}
        title="Could not load this agent"
        onRetry={() => void agent.refetch()}
      />
    )
  }
  return <AgentDetail agent={agent.data} workspaceId={workspaceId} />
}

function AgentDetail({ agent, workspaceId }: { agent: Agent; workspaceId: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = readTab(searchParams.get("tab"))
  const listHref = workspacePath(workspaceId)
  const archived = agent.status === "archived"

  function selectTab(key: Key) {
    const next = readTab(String(key))
    setSearchParams(next === "configuration" ? {} : { tab: next }, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        back={{ href: listHref, label: "Back to agents" }}
        title={
          <span className="flex min-w-0 items-center gap-3">
            <AgentIcon icon={agent.icon} size="lg" />
            <span className="truncate">{agent.name}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={archived ? "secondary" : "outline"}>
              {archived ? "Archived" : "Active"}
            </Badge>
            <Badge variant="outline" className="tabular-nums">
              v{agent.currentVersion.version}
            </Badge>
            {agent.description ? <span>{agent.description}</span> : null}
          </span>
        }
        actions={<HeaderActions agent={agent} workspaceId={workspaceId} />}
      />

      <Tabs selectedKey={tab} onSelectionChange={selectTab}>
        <TabsList aria-label="Agent sections">
          <TabsTrigger id="configuration">Configuration</TabsTrigger>
          <TabsTrigger id="actions">Actions</TabsTrigger>
          <TabsTrigger id="playground">Playground</TabsTrigger>
          <TabsTrigger id="versions">Versions</TabsTrigger>
        </TabsList>
        <TabsContent id="configuration" className="pt-2">
          <ConfigurationTab agent={agent} workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent id="actions" className="pt-2">
          {/* Keyed by version so a save (a new version) resets the edits to the new baseline. */}
          <ActionsTab key={agent.currentVersion.id} agent={agent} workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent id="playground" className="pt-2">
          <EmptyState
            icon={MessageSquare}
            title="Try your agent here soon"
            description="The playground will let you chat with the current version before you share it."
          />
        </TabsContent>
        <TabsContent id="versions" className="pt-2">
          <VersionsTab agent={agent} workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function HeaderActions({ agent, workspaceId }: { agent: Agent; workspaceId: string }) {
  const navigate = useNavigate()
  const sync = useSyncAgent(workspaceId, agent.id)
  const archive = useArchiveAgent(workspaceId)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const archived = agent.status === "archived"

  return (
    <>
      {agent.currentVersion.runtimeSynced ? null : (
        <Button
          variant="outline"
          className="text-amber-700 dark:text-amber-400"
          isPending={sync.isPending}
          onPress={() => sync.mutate()}
        >
          <RefreshCw aria-hidden="true" />
          Not synced, retry
        </Button>
      )}
      {archived ? null : (
        <>
          <DropdownMenuTrigger>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
            <DropdownMenu placement="bottom end" className="w-44">
              <DropdownMenuItem variant="destructive" onAction={() => setConfirmOpen(true)}>
                <Archive aria-hidden="true" />
                Archive agent
              </DropdownMenuItem>
            </DropdownMenu>
          </DropdownMenuTrigger>
          <ConfirmDestructive
            isOpen={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={`Archive ${agent.name}?`}
            description="Archiving is permanent: the agent stops being hosted and can no longer be edited or run. Its versions stay readable."
            confirmLabel="Archive agent"
            confirmPhrase={agent.name}
            isPending={archive.isPending}
            onConfirm={() =>
              archive.mutate(agent.id, {
                onSuccess: () => void navigate(workspacePath(workspaceId)),
              })
            }
          />
        </>
      )}
    </>
  )
}

function ConfigurationTab({ agent, workspaceId }: { agent: Agent; workspaceId: string }) {
  const update = useUpdateAgent(workspaceId, agent.id)
  const archived = agent.status === "archived"
  // Rebuilt only when the saved agent changes, so a save resets "dirty" to the new baseline.
  const defaultValues = React.useMemo(() => agentToForm(agent), [agent])

  return (
    <div className="grid gap-4">
      {archived ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground"
        >
          <Archive className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This agent is archived. Its configuration is read-only.
        </div>
      ) : null}
      <AgentForm
        // A new key per saved state remounts the form with the saved values as its baseline.
        key={`${agent.currentVersion.id}:${agent.updatedAt}`}
        defaultValues={defaultValues}
        submitLabel="Save changes"
        isPending={update.isPending}
        error={update.error}
        readOnly={archived}
        requireDirty
        onSubmit={(values) => update.mutate(values)}
      />
    </div>
  )
}

function VersionsTab({ agent, workspaceId }: { agent: Agent; workspaceId: string }) {
  const versions = useAgentVersions(workspaceId, agent.id)

  if (versions.isPending) return <LoadingRows rows={3} />
  if (versions.isError) {
    return (
      <ErrorState
        error={versions.error}
        title="Could not load versions"
        onRetry={() => void versions.refetch()}
      />
    )
  }
  return (
    <ul className="divide-y rounded-xl border" aria-label="Versions">
      {versions.data.versions.map((version) => (
        <VersionRow
          key={version.id}
          version={version}
          isCurrent={version.id === agent.currentVersion.id}
        />
      ))}
    </ul>
  )
}

function VersionRow({ version, isCurrent }: { version: AgentVersion; isCurrent: boolean }) {
  const [open, setOpen] = React.useState(false)
  const catalog = useModelCatalog()
  const panelId = `version-${version.id}-prompt`

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="font-medium tabular-nums">v{version.version}</span>
        {isCurrent ? <Badge>Current</Badge> : null}
        <span>{modelLabel(catalog, version.model)}</span>
        <span className="text-muted-foreground">{languageLabel(version.language)}</span>
        <span className="text-muted-foreground">{effortLabel(version.effort)} effort</span>
        <span className="text-muted-foreground">
          {version.actions.length === 1 ? "1 action" : `${version.actions.length} actions`}
        </span>
        <span className="ml-auto text-muted-foreground">
          {version.createdBy.name || version.createdBy.email},{" "}
          <RelativeTime value={version.createdAt} />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="grid gap-3 px-4 pb-4">
          {version.actions.length > 0 ? (
            <ul className="grid gap-1 text-sm" aria-label={`Actions of v${version.version}`}>
              {version.actions.map((action) => (
                <li
                  key={`${action.connectionId}/${action.toolName}`}
                  className="flex flex-wrap items-center gap-x-2"
                >
                  <span className="text-muted-foreground">{action.connectionName} /</span>
                  <span className="font-mono">{action.toolName}</span>
                  <Badge variant="outline">{permissionLabel(action.permission)}</Badge>
                  {action.stale ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <TriangleAlert className="size-3.5" aria-hidden="true" />
                      No longer offered
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No actions.</p>
          )}
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
            {version.systemPrompt}
          </pre>
        </div>
      ) : null}
    </li>
  )
}
