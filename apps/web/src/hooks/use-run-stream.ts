import { RunEvent, type RunStatus, type RunUsage } from "@clasp/shared"
import * as React from "react"

import { API_BASE_URL } from "@/lib/api-client"

/** How long a send waits for the live stream to connect before giving up. */
const OPEN_TIMEOUT_MS = 10_000

/** Statuses after which nothing more happens, so the stream is closed instead of kept alive. */
const TERMINAL: ReadonlySet<RunStatus> = new Set(["ended", "error"])

type State = { runId: string | null; ids: ReadonlySet<string>; events: RunEvent[] }

type Action = { runId: string; events: RunEvent[] }

const EMPTY: State = { runId: null, ids: new Set(), events: [] }

/**
 * Appends events not seen before, in arrival order. The server replays the whole history on
 * every (re)connect, so deduping by id is what makes reconnecting safe. An action for another
 * run starts that run's transcript from scratch.
 */
function merge(state: State, action: Action): State {
  const base = state.runId === action.runId ? state : { ...EMPTY, runId: action.runId }
  const fresh = action.events.filter((event) => !base.ids.has(event.id))
  if (fresh.length === 0) return base
  const ids = new Set(base.ids)
  for (const event of fresh) ids.add(event.id)
  return { runId: action.runId, ids, events: [...base.events, ...fresh] }
}

type Deferred = { promise: Promise<void>; resolve: () => void }

function deferred(): Deferred {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

export type RunStream = {
  /** Every event of the run, once each, in arrival order. */
  events: RunEvent[]
  /** The latest status event's status, or the fallback until one arrives. */
  status: RunStatus | undefined
  /** Tool calls waiting for the user's decision; empty unless awaiting approval. */
  pendingToolCallIds: string[]
  /** The latest usage event's figures, or the fallback until one arrives. */
  usage: RunUsage | undefined
  /** Resolves once the stream for `runId` is connected, so no early event is missed. */
  whenOpen: (runId: string) => Promise<void>
}

/**
 * The live event stream of one run, over Server-Sent Events.
 *
 * `EventSource` reconnects by itself; each reconnect replays the history, and the merge above
 * drops what was already seen. `seed` (the history from `GET /runs/:id`) and `fallback` (the
 * run's stored status and usage) cover the moment before the stream has said anything.
 */
export function useRunStream({
  workspaceId,
  runId,
  seed,
  fallback,
}: {
  workspaceId: string
  runId: string | null
  seed?: RunEvent[]
  fallback?: { status: RunStatus; usage: RunUsage }
}): RunStream {
  const [state, dispatch] = React.useReducer(merge, EMPTY)
  // The run whose stream is connected right now, and the sends waiting for one to connect.
  const openRunId = React.useRef<string | null>(null)
  const waiters = React.useRef(new Map<string, Deferred>())

  React.useEffect(() => {
    if (runId !== null && seed && seed.length > 0) dispatch({ runId, events: seed })
  }, [runId, seed])

  React.useEffect(() => {
    if (runId === null) return
    const url = `${API_BASE_URL}/api/v1/workspaces/${encodeURIComponent(
      workspaceId,
    )}/runs/${encodeURIComponent(runId)}/events`
    const source = new EventSource(url)

    function onOpen() {
      openRunId.current = runId
      const waiter = waiters.current.get(runId ?? "")
      if (waiter) {
        waiter.resolve()
        waiters.current.delete(runId ?? "")
      }
    }
    function onError() {
      // EventSource retries on its own; until it reopens, sends wait for it.
      if (openRunId.current === runId) openRunId.current = null
    }
    function onRunEvent(message: MessageEvent<string>) {
      let data: unknown
      try {
        data = JSON.parse(message.data)
      } catch {
        return
      }
      const parsed = RunEvent.safeParse(data)
      if (!parsed.success || runId === null) return
      dispatch({ runId, events: [parsed.data] })
      if (parsed.data.kind === "status" && TERMINAL.has(parsed.data.status)) {
        source.close()
        if (openRunId.current === runId) openRunId.current = null
      }
    }

    source.addEventListener("open", onOpen)
    source.addEventListener("error", onError)
    source.addEventListener("run-event", onRunEvent as EventListener)
    return () => {
      source.removeEventListener("open", onOpen)
      source.removeEventListener("error", onError)
      source.removeEventListener("run-event", onRunEvent as EventListener)
      source.close()
      if (openRunId.current === runId) openRunId.current = null
    }
  }, [workspaceId, runId])

  const whenOpen = React.useCallback((target: string): Promise<void> => {
    if (openRunId.current === target) return Promise.resolve()
    let waiter = waiters.current.get(target)
    if (!waiter) {
      waiter = deferred()
      waiters.current.set(target, waiter)
    }
    const pending = waiter.promise
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Could not connect to the run's live updates. Try again."))
      }, OPEN_TIMEOUT_MS)
      void pending.then(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }, [])

  const events = state.runId === runId ? state.events : EMPTY.events

  return React.useMemo(() => {
    let status = fallback?.status
    let pendingToolCallIds: string[] = []
    let usage = fallback?.usage
    for (const event of events) {
      if (event.kind === "status") {
        status = event.status
        pendingToolCallIds = event.status === "awaiting_approval" ? event.pendingToolCallIds : []
      } else if (event.kind === "usage") {
        usage = event.usage
      }
    }
    return { events, status, pendingToolCallIds, usage, whenOpen }
  }, [events, fallback?.status, fallback?.usage, whenOpen])
}
