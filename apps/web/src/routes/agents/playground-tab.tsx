import type { Agent, Run, RunEvent, RunStatus, RunUsage } from "@clasp/shared"
import {
  Archive,
  Ban,
  Check,
  ChevronDown,
  History,
  Info,
  MessageSquare,
  Plus,
  Send,
  Square,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import * as React from "react"
import { useSearchParams } from "react-router"
import { z } from "zod"

import { EmptyState, ErrorState } from "@/components/states"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useRunStream } from "@/hooks/use-run-stream"
import { errorDetail } from "@/lib/api-client"
import {
  useInterruptRun,
  usePlatform,
  useRun,
  useRuns,
  useSendRunMessage,
  useStartRun,
  useToolDecision,
} from "@/lib/queries"
import { cn } from "@/lib/utils"
import {
  formatCents,
  formatTokens,
  isClosed,
  runStatusAppearance,
  toolPermissionLabel,
} from "@/routes/agents/run-labels"

const RunId = z.uuid()

/** Output longer than this is cut, with "Show more" to read the rest. */
const OUTPUT_PREVIEW_CHARS = 600

/** How close to the bottom (in pixels) still counts as "following" the transcript. */
const STICK_THRESHOLD_PX = 48

type ToolCallEvent = Extract<RunEvent, { kind: "tool_call" }>
type ToolResultEvent = Extract<RunEvent, { kind: "tool_result" }>

type TranscriptItem =
  | { kind: "user" | "agent"; id: string; text: string }
  | { kind: "error"; id: string; message: string }
  | {
      kind: "tool"
      id: string
      call: ToolCallEvent
      result: ToolResultEvent | undefined
      decision: "allow" | "deny" | undefined
    }

/** Folds the raw events into what the transcript shows: results and decisions join their call. */
function toTranscript(events: RunEvent[]): TranscriptItem[] {
  const results = new Map<string, ToolResultEvent>()
  const decisions = new Map<string, "allow" | "deny">()
  for (const event of events) {
    if (event.kind === "tool_result") results.set(event.toolCallId, event)
    else if (event.kind === "tool_decision") decisions.set(event.toolCallId, event.decision)
  }
  const items: TranscriptItem[] = []
  for (const event of events) {
    switch (event.kind) {
      case "user_message":
        items.push({ kind: "user", id: event.id, text: event.text })
        break
      case "agent_message":
        items.push({ kind: "agent", id: event.id, text: event.text })
        break
      case "tool_call":
        items.push({
          kind: "tool",
          id: event.id,
          call: event,
          result: results.get(event.id),
          decision: decisions.get(event.id),
        })
        break
      case "error":
        items.push({ kind: "error", id: event.id, message: event.message })
        break
      default:
        break
    }
  }
  return items
}

/**
 * The agent's Playground tab: chat with the hosted agent and watch what it does.
 *
 * Each conversation is a run, named in the URL (`?run=`) so a reload reopens it. The run is
 * created by the first message, not by "New run", so an abandoned empty state costs nothing.
 */
export function PlaygroundTab({ agent, workspaceId }: { agent: Agent; workspaceId: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawRunId = searchParams.get("run")
  const runId = rawRunId !== null && RunId.safeParse(rawRunId).success ? rawRunId : null
  const archived = agent.status === "archived"

  const platform = usePlatform()
  const run = useRun(workspaceId, runId)
  const startRun = useStartRun(workspaceId, agent.id)
  const sendMessage = useSendRunMessage(workspaceId)
  const [sendError, setSendError] = React.useState<string | null>(null)

  const fallback = React.useMemo(
    () => (run.data ? { status: run.data.status, usage: run.data.usage } : undefined),
    [run.data],
  )
  const stream = useRunStream({ workspaceId, runId, seed: run.data?.events, fallback })
  const { status, usage, pendingToolCallIds } = stream

  const selectRun = React.useCallback(
    (id: string | null) => {
      setSendError(null)
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (id === null) next.delete("run")
          else next.set("run", id)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  async function send(text: string): Promise<boolean> {
    setSendError(null)
    try {
      let target = runId
      if (target === null) {
        const created = await startRun.mutateAsync()
        target = created.id
        selectRun(target)
      }
      // The stream must be connected before the message goes out, or its first events
      // could be missed.
      await stream.whenOpen(target)
      await sendMessage.mutateAsync({ runId: target, text })
      return true
    } catch (error) {
      setSendError(errorDetail(error))
      return false
    }
  }

  const closed = isClosed(status)
  const awaitingApproval = status === "awaiting_approval"
  const disabledReason = awaitingApproval
    ? "Approve or deny the pending action to continue."
    : closed
      ? "This run is closed. Start a new run to keep chatting."
      : null

  return (
    <div className="grid gap-3">
      {platform.data?.runtime.simulated ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Simulated runtime: replies are placeholders. Set ANTHROPIC_API_KEY on the server to run
          this agent on Claude.
        </div>
      ) : null}
      {archived ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground"
        >
          <Archive className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This agent is archived and can no longer run. Past runs stay readable.
        </div>
      ) : null}

      <RunHeader
        agentId={agent.id}
        workspaceId={workspaceId}
        run={run.data}
        status={status}
        usage={usage}
        onSelectRun={selectRun}
        canStartNew={!archived}
      />

      <Transcript
        agentName={agent.name}
        archived={archived}
        runId={runId}
        workspaceId={workspaceId}
        events={stream.events}
        status={status}
        pendingToolCallIds={pendingToolCallIds}
        loadError={run.isError && stream.events.length === 0 ? run.error : null}
        onRetry={() => void run.refetch()}
      />

      {status === "budget_reached" ? (
        <RunAlert
          action={
            <Button size="sm" variant="outline" onPress={() => selectRun(null)}>
              <Plus aria-hidden="true" />
              New run
            </Button>
          }
        >
          {run.data
            ? `This run reached its ${formatCents(run.data.budgetCents)} spending cap. Start a new run to continue.`
            : "This run reached its spending cap. Start a new run to continue."}
        </RunAlert>
      ) : null}
      {status === "ended" || status === "error" ? (
        <RunAlert
          tone={status === "error" ? "destructive" : "muted"}
          action={
            archived ? null : (
              <Button size="sm" variant="outline" onPress={() => selectRun(null)}>
                <Plus aria-hidden="true" />
                New run
              </Button>
            )
          }
        >
          {status === "error" ? "This run stopped with an error." : "This run has ended."}
        </RunAlert>
      ) : null}

      {archived ? null : (
        <Composer
          agentName={agent.name}
          disabledReason={disabledReason}
          error={sendError}
          onSend={send}
        />
      )}
    </div>
  )
}

function RunAlert({
  tone = "destructive",
  action,
  children,
}: {
  tone?: "destructive" | "muted"
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm",
        tone === "destructive"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "bg-muted/50 text-muted-foreground",
      )}
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{children}</span>
      {action}
    </div>
  )
}

function RunHeader({
  agentId,
  workspaceId,
  run,
  status,
  usage,
  onSelectRun,
  canStartNew,
}: {
  agentId: string
  workspaceId: string
  run: Run | undefined
  status: RunStatus | undefined
  usage: RunUsage | undefined
  onSelectRun: (id: string | null) => void
  canStartNew: boolean
}) {
  const runs = useRuns(workspaceId, agentId)
  const interrupt = useInterruptRun(workspaceId, run?.id ?? "")
  const recent = runs.data?.runs ?? []
  const appearance = status ? runStatusAppearance(status) : null

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2 text-sm"
      aria-label="Run"
      role="group"
    >
      {run && appearance ? (
        <>
          <StatusBadge tone={appearance.tone} label={appearance.label} />
          <span className="text-muted-foreground tabular-nums">Pinned to v{run.agentVersion}</span>
          {usage ? (
            <>
              <span className="tabular-nums">
                {formatCents(usage.costCents)} of {formatCents(run.budgetCents)}
              </span>
              <span className="text-muted-foreground tabular-nums">{formatTokens(usage)}</span>
            </>
          ) : null}
        </>
      ) : (
        <span className="text-muted-foreground">No run yet</span>
      )}
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {run && status === "running" ? (
          <Button
            size="sm"
            variant="outline"
            isPending={interrupt.isPending}
            onPress={() => interrupt.mutate()}
          >
            <Square aria-hidden="true" />
            Stop
          </Button>
        ) : null}
        {recent.length > 0 ? (
          <DropdownMenuTrigger>
            <Button size="sm" variant="ghost">
              <History aria-hidden="true" />
              Recent runs
              <ChevronDown aria-hidden="true" />
            </Button>
            <DropdownMenu placement="bottom end" className="w-64">
              {recent.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  textValue={runLabel(item)}
                  onAction={() => onSelectRun(item.id)}
                >
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{runLabel(item)}</span>
                    <span className="text-xs text-muted-foreground">
                      {runStatusAppearance(item.status).label}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenu>
          </DropdownMenuTrigger>
        ) : null}
        {run && canStartNew ? (
          <Button size="sm" variant="outline" onPress={() => onSelectRun(null)}>
            <Plus aria-hidden="true" />
            New run
          </Button>
        ) : null}
      </span>
    </div>
  )
}

const startedFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" })

function runLabel(run: Run): string {
  return `${startedFormat.format(new Date(run.startedAt))}, v${run.agentVersion}`
}

function Transcript({
  agentName,
  archived,
  runId,
  workspaceId,
  events,
  status,
  pendingToolCallIds,
  loadError,
  onRetry,
}: {
  agentName: string
  archived: boolean
  runId: string | null
  workspaceId: string
  events: RunEvent[]
  status: RunStatus | undefined
  pendingToolCallIds: string[]
  loadError: unknown
  onRetry: () => void
}) {
  const items = React.useMemo(() => toTranscript(events), [events])
  const pending = React.useMemo(() => new Set(pendingToolCallIds), [pendingToolCallIds])
  const thinking = status === "running"
  const scroller = React.useRef<HTMLDivElement>(null)
  // Follow new events only while the user is at the bottom; scrolling up to read stops it.
  const stick = React.useRef(true)

  React.useLayoutEffect(() => {
    const element = scroller.current
    if (element && stick.current) element.scrollTop = element.scrollHeight
  }, [items.length, thinking, pendingToolCallIds])

  function onScroll() {
    const element = scroller.current
    if (!element) return
    stick.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD_PX
  }

  let body: React.ReactNode
  if (loadError) {
    body = <ErrorState error={loadError} title="Could not load this run" onRetry={onRetry} />
  } else if (items.length === 0 && !thinking) {
    body =
      runId === null && archived ? (
        <EmptyState
          icon={History}
          title="No run open"
          description="Open a past run from Recent runs to read it."
        />
      ) : (
        <EmptyState
          icon={MessageSquare}
          title={`Say hello to ${agentName}`}
          description="Your first message starts a run. Each run has its own spending cap."
        />
      )
  } else {
    body = (
      <ol className="grid gap-3" aria-label="Transcript">
        {items.map((item) => (
          <li key={item.id} className="grid">
            <TranscriptEntry
              item={item}
              runId={runId ?? ""}
              workspaceId={workspaceId}
              isPending={pending.has(item.id)}
            />
          </li>
        ))}
      </ol>
    )
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="h-[min(60vh,36rem)] min-h-72 overflow-y-auto rounded-xl border p-4"
    >
      {body}
      {thinking ? (
        <p
          className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <Spinner aria-hidden="true" role="presentation" className="size-3.5" />
          Thinking...
        </p>
      ) : null}
    </div>
  )
}

function TranscriptEntry({
  item,
  runId,
  workspaceId,
  isPending,
}: {
  item: TranscriptItem
  runId: string
  workspaceId: string
  isPending: boolean
}) {
  switch (item.kind) {
    case "user":
      return (
        <div className="max-w-[85%] justify-self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
          <span className="sr-only">You: </span>
          {item.text}
        </div>
      )
    case "agent":
      return (
        <div className="max-w-[85%] justify-self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          <span className="sr-only">Agent: </span>
          {item.text}
        </div>
      )
    case "error":
      return <RunAlert>{item.message}</RunAlert>
    case "tool":
      return (
        <ToolCallCard
          call={item.call}
          result={item.result}
          decision={item.decision}
          isPending={isPending}
          runId={runId}
          workspaceId={workspaceId}
        />
      )
  }
}

function ToolCallCard({
  call,
  result,
  decision,
  isPending,
  runId,
  workspaceId,
}: {
  call: ToolCallEvent
  result: ToolResultEvent | undefined
  decision: "allow" | "deny" | undefined
  isPending: boolean
  runId: string
  workspaceId: string
}) {
  const title = `${call.toolName} on ${call.connectionName}`
  const failed = result?.isError === true

  return (
    <article
      aria-label={title}
      className={cn(
        "grid gap-2 rounded-xl border p-3 text-sm",
        failed && "border-destructive/40 bg-destructive/5",
        isPending && "border-amber-400 dark:border-amber-600",
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          <span className="font-mono">{call.toolName}</span>
          <span className="text-muted-foreground"> on {call.connectionName}</span>
        </span>
        <Badge variant="outline">{toolPermissionLabel(call.permission)}</Badge>
        {decision === "allow" ? (
          <Badge variant="secondary">
            <Check aria-hidden="true" />
            Approved
          </Badge>
        ) : decision === "deny" ? (
          <Badge variant="destructive">
            <Ban aria-hidden="true" />
            Denied
          </Badge>
        ) : null}
        {failed ? <Badge variant="destructive">Error</Badge> : null}
      </header>
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">Input</summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
          {JSON.stringify(call.input, null, 2)}
        </pre>
      </details>
      {result ? <ToolOutput output={result.output} isError={result.isError} /> : null}
      {isPending && decision === undefined ? (
        <ApprovalControls toolCallId={call.id} runId={runId} workspaceId={workspaceId} />
      ) : null}
    </article>
  )
}

function ToolOutput({ output, isError }: { output: string; isError: boolean }) {
  const [expanded, setExpanded] = React.useState(false)
  const long = output.length > OUTPUT_PREVIEW_CHARS
  const shown = long && !expanded ? `${output.slice(0, OUTPUT_PREVIEW_CHARS)}...` : output

  return (
    <details open>
      <summary className="cursor-pointer text-xs text-muted-foreground">
        {isError ? "Error output" : "Output"}
      </summary>
      <pre
        className={cn(
          "mt-1 max-h-96 overflow-auto rounded-lg bg-muted p-2 font-mono text-xs whitespace-pre-wrap",
          isError && "text-destructive",
        )}
      >
        {shown}
      </pre>
      {long ? (
        <Button size="xs" variant="link" onPress={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </details>
  )
}

function ApprovalControls({
  toolCallId,
  runId,
  workspaceId,
}: {
  toolCallId: string
  runId: string
  workspaceId: string
}) {
  const decide = useToolDecision(workspaceId, runId)
  const [denying, setDenying] = React.useState(false)
  const [reason, setReason] = React.useState("")
  // Hidden once sent; the card then waits for the `tool_decision` event to show the outcome.
  if (decide.isSuccess) {
    return <p className="text-xs text-muted-foreground">Decision sent.</p>
  }

  if (denying) {
    return (
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const denyMessage = reason.trim()
          decide.mutate({
            toolCallId,
            decision: "deny",
            ...(denyMessage ? { denyMessage } : {}),
          })
        }}
      >
        <label className="grid gap-1 text-xs text-muted-foreground">
          Tell the agent why (optional)
          <Input
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            autoFocus
          />
        </label>
        <span className="flex gap-2">
          <Button type="submit" size="sm" variant="destructive" isPending={decide.isPending}>
            Deny action
          </Button>
          <Button size="sm" variant="ghost" onPress={() => setDenying(false)}>
            Cancel
          </Button>
        </span>
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">The agent is waiting for your decision.</span>
      <Button
        size="sm"
        isPending={decide.isPending}
        onPress={() => decide.mutate({ toolCallId, decision: "allow" })}
      >
        <Check aria-hidden="true" />
        Approve
      </Button>
      <Button size="sm" variant="outline" onPress={() => setDenying(true)}>
        <Ban aria-hidden="true" />
        Deny
      </Button>
    </div>
  )
}

function Composer({
  agentName,
  disabledReason,
  error,
  onSend,
}: {
  agentName: string
  disabledReason: string | null
  error: string | null
  onSend: (text: string) => Promise<boolean>
}) {
  const [text, setText] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const disabled = disabledReason !== null
  const hintId = React.useId()

  async function submit() {
    const trimmed = text.trim()
    if (!trimmed || sending || disabled) return
    setSending(true)
    const sent = await onSend(trimmed)
    setSending(false)
    if (sent) setText("")
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Message"
          aria-describedby={disabledReason || error ? hintId : undefined}
          placeholder={`Message ${agentName}`}
          value={text}
          disabled={disabled || sending}
          className="min-h-11 flex-1"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        <Button
          type="submit"
          isDisabled={disabled || text.trim() === ""}
          isPending={sending}
          aria-label="Send"
        >
          <Send aria-hidden="true" />
        </Button>
      </div>
      {error ? (
        <p id={hintId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : disabledReason ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {disabledReason}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Enter to send, Shift+Enter for a new line.</p>
      )}
    </form>
  )
}
