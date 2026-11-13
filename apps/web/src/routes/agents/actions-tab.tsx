import type { ActionPermission, Agent, McpConnection, McpTool } from "@clasp/shared"
import { Archive, Plug, RefreshCw, TriangleAlert, X } from "lucide-react"
import * as React from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Radio, RadioGroup } from "@/components/ui/radio-group"
import { errorDetail } from "@/lib/api-client"
import { workspacePath } from "@/lib/nav"
import { useConnections, useDiscoverConnection, useUpdateAgent } from "@/lib/queries"
import {
  agentToForm,
  versionActions,
  type ActionFormValues,
} from "@/routes/agents/agent-form-schema"
import { PERMISSION_OPTIONS, permissionLabel } from "@/routes/agents/agent-labels"
import { countLabel } from "@/routes/connections/connection-labels"
import { ConnectionStatusBadge } from "@/routes/connections/connection-status-badge"
import { ToolInputs } from "@/routes/connections/tool-inputs"

export const USAGE_NOTE_MAX = 500

function actionKey(action: { connectionId: string; toolName: string }): string {
  return `${action.connectionId}/${action.toolName}`
}

/** Order-independent and whitespace-insensitive, matching what the API would store. */
function normalized(actions: ActionFormValues[]): string {
  return JSON.stringify(
    actions
      .map((action) => ({ ...action, usageNote: action.usageNote.trim() }))
      .sort((a, b) => actionKey(a).localeCompare(actionKey(b))),
  )
}

/**
 * The agent's Actions tab: pick which connected tools the agent may use and govern each one.
 *
 * Edits are local until saved; saving sends the whole config (actions are part of it), so the
 * API records a new version. The parent remounts this per version, which resets the baseline.
 */
export function ActionsTab({ agent, workspaceId }: { agent: Agent; workspaceId: string }) {
  const connections = useConnections(workspaceId)
  const discover = useDiscoverConnection(workspaceId)
  const update = useUpdateAgent(workspaceId, agent.id)
  const readOnly = agent.status === "archived"

  const initial = React.useMemo(() => versionActions(agent), [agent])
  const [actions, setActions] = React.useState<ActionFormValues[]>(initial)
  const dirty = normalized(actions) !== normalized(initial)

  const byKey = React.useMemo(
    () => new Map(actions.map((action) => [actionKey(action), action])),
    [actions],
  )

  function toggle(connectionId: string, toolName: string, enabled: boolean) {
    setActions((current) =>
      enabled
        ? [...current, { connectionId, toolName, permission: "ask", usageNote: "" }]
        : current.filter((action) => actionKey(action) !== actionKey({ connectionId, toolName })),
    )
  }

  function change(key: string, patch: Partial<ActionFormValues>) {
    setActions((current) =>
      current.map((action) => (actionKey(action) === key ? { ...action, ...patch } : action)),
    )
  }

  function save() {
    const { config } = agentToForm(agent)
    update.mutate({
      config: {
        ...config,
        actions: actions.map((action) => ({ ...action, usageNote: action.usageNote.trim() })),
      },
    })
  }

  if (connections.isPending) return <LoadingRows rows={3} />
  if (connections.isError) {
    return (
      <ErrorState
        error={connections.error}
        title="Could not load connections"
        onRetry={() => void connections.refetch()}
      />
    )
  }

  const list = connections.data.connections
  const offered = new Set(
    list.flatMap((connection) =>
      connection.tools.map((tool) =>
        actionKey({ connectionId: connection.id, toolName: tool.name }),
      ),
    ),
  )
  const staleFlags = new Map(
    agent.currentVersion.actions.map((action) => [actionKey(action), action] as const),
  )
  // Stale: the API says so, or the tool is not among what the connections offer right now.
  const stale = actions.filter(
    (action) =>
      staleFlags.get(actionKey(action))?.stale === true || !offered.has(actionKey(action)),
  )

  return (
    <div className="grid gap-4">
      {readOnly ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground"
        >
          <Archive className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This agent is archived. Its actions are read-only.
        </div>
      ) : null}

      {stale.length > 0 ? (
        <div
          role="alert"
          className="grid gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
        >
          <p className="flex items-start gap-2 font-medium text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {stale.length === 1
              ? "1 action is no longer offered by its connection"
              : `${stale.length} actions are no longer offered by their connections`}
          </p>
          <p className="text-muted-foreground">
            The agent skips these until the tool comes back. Remove them, or rediscover the
            connection if the tool should still exist.
          </p>
          <ul className="grid gap-1" aria-label="Stale actions">
            {stale.map((action) => {
              const connectionName =
                list.find((connection) => connection.id === action.connectionId)?.name ??
                staleFlags.get(actionKey(action))?.connectionName ??
                "Removed connection"
              return (
                <li key={actionKey(action)} className="flex items-center gap-2">
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{connectionName} / </span>
                    <span className="font-mono">{action.toolName}</span>
                  </span>
                  {readOnly ? null : (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="ml-auto"
                      onPress={() => toggle(action.connectionId, action.toolName, false)}
                      aria-label={`Remove ${action.toolName}`}
                    >
                      <X aria-hidden="true" />
                      Remove
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No connections yet"
          description="Actions are tools exposed by MCP servers. Connect a server to this workspace, then come back to pick the tools this agent may use."
        >
          <LinkButton href={workspacePath(workspaceId, "connections")}>
            Go to Connections
          </LinkButton>
        </EmptyState>
      ) : (
        list.map((connection) => (
          <ConnectionActions
            key={connection.id}
            connection={connection}
            byKey={byKey}
            readOnly={readOnly}
            isDiscovering={discover.isPending && discover.variables === connection.id}
            onDiscover={() => discover.mutate(connection.id)}
            onToggle={toggle}
            onChange={change}
          />
        ))
      )}

      {update.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{errorDetail(update.error)}</span>
        </div>
      ) : null}

      {readOnly ? null : (
        <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <span className="mr-auto text-sm text-muted-foreground">
            {dirty
              ? "Unsaved changes. Saving creates a new version."
              : countLabel(actions.length, "action") + " enabled"}
          </span>
          {dirty ? (
            <Button variant="outline" onPress={() => setActions(initial)}>
              Discard
            </Button>
          ) : null}
          <Button isDisabled={!dirty} isPending={update.isPending} onPress={save}>
            Save actions
          </Button>
        </div>
      )}
    </div>
  )
}

function ConnectionActions({
  connection,
  byKey,
  readOnly,
  isDiscovering,
  onDiscover,
  onToggle,
  onChange,
}: {
  connection: McpConnection
  byKey: Map<string, ActionFormValues>
  readOnly: boolean
  isDiscovering: boolean
  onDiscover: () => void
  onToggle: (connectionId: string, toolName: string, enabled: boolean) => void
  onChange: (key: string, patch: Partial<ActionFormValues>) => void
}) {
  return (
    <Card role="group" aria-label={connection.name}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="truncate">{connection.name}</h2>
          <ConnectionStatusBadge status={connection.status} />
        </CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            isPending={isDiscovering}
            isDisabled={readOnly}
            onPress={onDiscover}
            aria-label={`Rediscover ${connection.name}`}
          >
            <RefreshCw aria-hidden="true" />
            Rediscover
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {connection.status === "error" && connection.lastError ? (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{connection.lastError}</span>
          </p>
        ) : null}
        {connection.tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tools discovered yet. Rediscover to ask the server again.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border" aria-label={`Tools of ${connection.name}`}>
            {connection.tools.map((tool) => {
              const key = actionKey({ connectionId: connection.id, toolName: tool.name })
              return (
                <ToolRow
                  key={tool.name}
                  idPrefix={`${connection.id}-${tool.name}`}
                  tool={tool}
                  action={byKey.get(key)}
                  readOnly={readOnly}
                  onToggle={(enabled) => onToggle(connection.id, tool.name, enabled)}
                  onChange={(patch) => onChange(key, patch)}
                />
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ToolRow({
  idPrefix,
  tool,
  action,
  readOnly,
  onToggle,
  onChange,
}: {
  idPrefix: string
  tool: McpTool
  action: ActionFormValues | undefined
  readOnly: boolean
  onToggle: (enabled: boolean) => void
  onChange: (patch: Partial<ActionFormValues>) => void
}) {
  const enabled = action !== undefined
  const noteId = `${idPrefix}-note`

  return (
    <li className="grid gap-3 px-3 py-3">
      <div className="grid gap-1">
        <div className="flex items-start gap-2">
          <Checkbox
            isSelected={enabled}
            onChange={onToggle}
            isDisabled={readOnly}
            aria-label={`Enable ${tool.name}`}
          >
            <span className="flex flex-wrap items-baseline gap-x-2">
              {tool.title ? <span className="font-medium">{tool.title}</span> : null}
              <span className="font-mono text-sm">{tool.name}</span>
            </span>
          </Checkbox>
          {enabled ? (
            <Badge variant="outline" className="ml-auto">
              {permissionLabel(action.permission)}
            </Badge>
          ) : null}
        </div>
        {tool.description ? (
          <p className="pl-6 text-sm text-muted-foreground">{tool.description}</p>
        ) : null}
      </div>

      {enabled ? (
        <div className="grid gap-4 pl-6">
          <RadioGroup
            aria-label={`Permission for ${tool.name}`}
            value={action.permission}
            onChange={(value) => onChange({ permission: value as ActionPermission })}
            isDisabled={readOnly}
            className="grid gap-2 sm:grid-cols-2"
          >
            {PERMISSION_OPTIONS.map((option) => (
              <Radio
                key={option.value}
                value={option.value}
                className="rounded-lg border p-2.5 data-selected:border-primary/40 data-selected:bg-primary/5"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </span>
              </Radio>
            ))}
          </RadioGroup>
          <div className="grid gap-2">
            <FieldLabel htmlFor={noteId}>Usage note</FieldLabel>
            <Input
              id={noteId}
              value={action.usageNote}
              maxLength={USAGE_NOTE_MAX}
              disabled={readOnly}
              placeholder="When should the agent use this? Optional"
              autoComplete="off"
              onChange={(event) => onChange({ usageNote: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      <div className="pl-6">
        <ToolInputs tool={tool} idPrefix={idPrefix} />
      </div>
    </li>
  )
}
