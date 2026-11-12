import {
  DEFAULT_MODEL_ID,
  type Agent,
  type Run,
  type RunEvent,
  type RunStatus,
  type RunWithEvents,
} from "@clasp/shared"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MockEventSource, mockEventSource } from "@/test/mock-event-source"
import { ME, mockApi, renderApp, type MockHandler, type MockRequest } from "@/test/render-app"

const WS = ME.workspaces[0]!.id
const AGENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const RUN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const AGENT_PATH = `/api/v1/workspaces/${WS}/agents/${AGENT_ID}`
const RUN_PATH = `/api/v1/workspaces/${WS}/runs/${RUN_ID}`
const AT = "2026-11-13T10:00:00.000Z"

const AGENT: Agent = {
  id: AGENT_ID,
  workspaceId: WS,
  name: "Support bot",
  description: "",
  icon: "🤖",
  status: "active",
  visibility: "private",
  currentVersion: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000003",
    version: 3,
    model: DEFAULT_MODEL_ID,
    language: "en",
    effort: "medium",
    systemPrompt: "Be helpful.",
    actions: [],
    runtimeSynced: true,
    createdAt: AT,
    createdBy: ME.user,
  },
  createdAt: AT,
  updatedAt: AT,
}

function run(status: RunStatus = "idle", events: RunEvent[] = []): RunWithEvents {
  return {
    id: RUN_ID,
    agentId: AGENT_ID,
    agentVersion: 3,
    status,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costCents: 0,
    },
    budgetCents: 100,
    createdBy: ME.user,
    startedAt: AT,
    updatedAt: AT,
    events,
  }
}

function on(
  method: string,
  path: string,
  respond: (request: MockRequest) => Response,
): MockHandler {
  return (request) =>
    request.method === method && request.path === path ? respond(request) : undefined
}

const noContent = () => new Response(null, { status: 204 })

/** The API of one active agent, its platform info and (optionally) one existing run. */
function playgroundApi(
  options: { simulated?: boolean; runs?: Run[]; current?: RunWithEvents } = {},
  extra: MockHandler[] = [],
) {
  return mockApi(ME, [
    ...extra,
    on("GET", AGENT_PATH, () => Response.json(AGENT)),
    on("GET", "/api/v1/platform", () =>
      Response.json({ runtime: { provider: "anthropic", simulated: options.simulated ?? false } }),
    ),
    on("GET", `${AGENT_PATH}/runs`, () => Response.json({ runs: options.runs ?? [] })),
    on("GET", RUN_PATH, () => Response.json(options.current ?? run())),
  ])
}

function event<K extends RunEvent["kind"]>(
  id: string,
  kind: K,
  fields: Omit<Extract<RunEvent, { kind: K }>, "id" | "at" | "kind">,
): RunEvent {
  return { id, at: AT, kind, ...fields } as RunEvent
}

async function openStream(): Promise<MockEventSource> {
  let source: MockEventSource | undefined
  await waitFor(() => {
    source = MockEventSource.find(`/runs/${RUN_ID}/events`)
    expect(source?.readyState).toBe(MockEventSource.OPEN)
  })
  return source!
}

beforeEach(() => {
  mockEventSource()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("playground", () => {
  it("starts a run with the first message, opening the stream before posting it", async () => {
    let streamOpenAtSend: boolean | undefined
    let sentBody: unknown
    playgroundApi({}, [
      on("POST", `${AGENT_PATH}/runs`, () => Response.json(run(), { status: 201 })),
      on("POST", `${RUN_PATH}/messages`, (request) => {
        streamOpenAtSend =
          MockEventSource.find(`/runs/${RUN_ID}/events`)?.readyState === MockEventSource.OPEN
        sentBody = request.body
        return noContent()
      }),
    ])
    const user = userEvent.setup()
    const router = renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=playground`)

    expect(await screen.findByText("Say hello to Support bot")).toBeTruthy()
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Hi there{Enter}")

    await waitFor(() => expect(sentBody).toEqual({ text: "Hi there" }))
    expect(streamOpenAtSend).toBe(true)
    expect(new URLSearchParams(router.state.location.search).get("run")).toBe(RUN_ID)
    await waitFor(() =>
      expect((screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement).value).toBe(
        "",
      ),
    )

    const source = await openStream()
    source.push(
      event("e1", "user_message", { text: "Hi there" }),
      event("e2", "status", { status: "running", pendingToolCallIds: [] }),
      event("e3", "agent_message", { text: "Hello!\nHow can I help?" }),
      event("e4", "status", { status: "idle", pendingToolCallIds: [] }),
    )

    const transcript = await screen.findByRole("list", { name: "Transcript" })
    expect(within(transcript).getByText(/Hello!/)).toBeTruthy()
    expect(within(transcript).getByText("Hi there")).toBeTruthy()
    expect(screen.getByText("Pinned to v3")).toBeTruthy()
  })

  it("shows the server's detail when the run cannot start", async () => {
    playgroundApi({}, [
      on("POST", `${AGENT_PATH}/runs`, () =>
        Response.json({ detail: "This agent is not hosted yet." }, { status: 409 }),
      ),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=playground`)

    await user.type(await screen.findByRole("textbox", { name: "Message" }), "Hi{Enter}")
    expect(await screen.findByText("This agent is not hosted yet.")).toBeTruthy()
  })

  it("renders an event once even when the stream replays it", async () => {
    playgroundApi({ current: run() })
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=playground&run=${RUN_ID}`)

    const source = await openStream()
    const reply = event("e1", "agent_message", { text: "Only once" })
    source.push(reply, reply)
    source.push(reply)

    expect(await screen.findByText("Only once")).toBeTruthy()
    expect(screen.getAllByText("Only once")).toHaveLength(1)
  })

  it("asks for approval and posts the decision", async () => {
    let decision: unknown
    playgroundApi({ current: run() }, [
      on("POST", `${RUN_PATH}/tool-decisions`, (request) => {
        decision = request.body
        return noContent()
      }),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=playground&run=${RUN_ID}`)

    const source = await openStream()
    source.push(
      event("call-1", "tool_call", {
        toolName: "search_crm",
        connectionName: "CRM",
        input: { query: "Ada" },
        permission: "ask",
      }),
      event("s1", "status", { status: "awaiting_approval", pendingToolCallIds: ["call-1"] }),
    )

    const card = await screen.findByRole("article", { name: "search_crm on CRM" })
    expect(within(card).getByText("Ask me first")).toBeTruthy()
    expect(within(card).getByRole("button", { name: "Deny" })).toBeTruthy()
    expect(screen.getByText("Approve or deny the pending action to continue.")).toBeTruthy()
    expect((screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement).disabled).toBe(
      true,
    )

    await user.click(within(card).getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(decision).toEqual({ toolCallId: "call-1", decision: "allow" }))

    source.push(
      event("d1", "tool_decision", { toolCallId: "call-1", decision: "allow" }),
      event("s2", "status", { status: "running", pendingToolCallIds: [] }),
      event("r1", "tool_result", {
        toolCallId: "call-1",
        output: "1 contact found",
        isError: false,
      }),
    )
    expect(await within(card).findByText("Approved")).toBeTruthy()
    expect(within(card).getByText("1 contact found")).toBeTruthy()
    expect(within(card).queryByRole("button", { name: "Approve" })).toBeNull()
  })

  it("shows the simulated runtime banner", async () => {
    playgroundApi({ simulated: true })
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=playground`)

    expect(await screen.findByText(/Simulated runtime: replies are placeholders/)).toBeTruthy()
  })

  it("renders usage against the budget and closes the composer at the cap", async () => {
    playgroundApi({ current: run() })
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=playground&run=${RUN_ID}`)

    const source = await openStream()
    source.push(
      event("u1", "usage", {
        usage: {
          inputTokens: 1200,
          outputTokens: 345,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          costCents: 4,
        },
      }),
    )
    expect(await screen.findByText("$0.04 of $1.00")).toBeTruthy()
    expect(screen.getByText("1,200 in / 345 out tokens")).toBeTruthy()

    source.push(event("s1", "status", { status: "budget_reached", pendingToolCallIds: [] }))
    expect(
      await screen.findByText(
        "This run reached its $1.00 spending cap. Start a new run to continue.",
      ),
    ).toBeTruthy()
    expect((screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement).disabled).toBe(
      true,
    )
  })

  it("shows a read-only notice for an archived agent", async () => {
    mockApi(ME, [
      on("GET", AGENT_PATH, () => Response.json({ ...AGENT, status: "archived" })),
      on("GET", "/api/v1/platform", () =>
        Response.json({ runtime: { provider: "anthropic", simulated: false } }),
      ),
      on("GET", `${AGENT_PATH}/runs`, () => Response.json({ runs: [] })),
    ])
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=playground`)

    expect(await screen.findByText(/This agent is archived and can no longer run/)).toBeTruthy()
    expect(screen.queryByRole("textbox", { name: "Message" })).toBeNull()
  })
})
