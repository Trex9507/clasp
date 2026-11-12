import {
  DEFAULT_MODEL_ID,
  type Agent,
  type AgentSummary,
  type AgentVersion,
  type McpConnection,
} from "@clasp/shared"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ME, mockApi, type MockHandler } from "@/test/render-app"
import { renderApp } from "@/test/render-app"

const WS = ME.workspaces[0]!.id
const AGENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const BASE = `/api/v1/workspaces/${WS}/agents`
const CONNECTIONS = `/api/v1/workspaces/${WS}/mcp-connections`
const CONN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

const ORDERS: McpConnection = {
  id: CONN_ID,
  name: "Orders",
  url: "https://orders.example.com/mcp",
  authType: "bearer",
  hasCredential: true,
  status: "ok",
  lastError: null,
  lastCheckedAt: "2026-11-01T10:00:00.000Z",
  tools: [
    {
      name: "lookup_order",
      title: "Look up an order",
      description: "Finds an order by its id.",
      inputSchema: {
        type: "object",
        properties: { order_id: { type: "string", description: "The order id" } },
        required: ["order_id"],
      },
    },
    { name: "refund_order", description: "Refunds an order.", inputSchema: { type: "object" } },
  ],
  usedBy: [],
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
}

function version(
  n: number,
  systemPrompt: string,
  actions: AgentVersion["actions"] = [],
): AgentVersion {
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-00000000000${n}`,
    version: n,
    model: DEFAULT_MODEL_ID,
    language: "en",
    effort: "medium",
    systemPrompt,
    actions,
    runtimeSynced: true,
    createdAt: "2026-11-01T10:00:00.000Z",
    createdBy: ME.user,
  }
}

function agent(current: AgentVersion, overrides: Partial<Agent> = {}): Agent {
  return {
    id: AGENT_ID,
    workspaceId: WS,
    name: "Support bot",
    description: "Answers order questions",
    icon: "🤖",
    status: "active",
    visibility: "private",
    currentVersion: current,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: current.createdAt,
    ...overrides,
  }
}

const SUMMARY: AgentSummary = {
  id: AGENT_ID,
  name: "Support bot",
  description: "Answers order questions",
  icon: "🤖",
  status: "active",
  visibility: "private",
  model: DEFAULT_MODEL_ID,
  language: "en",
  version: 3,
  actionCount: 0,
  runtimeSynced: false,
  updatedAt: "2026-11-01T10:00:00.000Z",
}

function on(method: string, path: string, respond: (body: unknown) => Response): MockHandler {
  return (request) =>
    request.method === method && request.path === path ? respond(request.body) : undefined
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("agents list", () => {
  it("renders the agents the API returns", async () => {
    mockApi(ME, [on("GET", `${BASE}?status=active`, () => Response.json({ agents: [SUMMARY] }))])
    renderApp(`/w/${WS}/agents`)

    const table = await screen.findByRole("grid", { name: "Active agents" })
    expect(within(table).getByText("Support bot")).toBeTruthy()
    expect(within(table).getByText("Answers order questions")).toBeTruthy()
    expect(within(table).getByText("Claude Sonnet 5.5")).toBeTruthy()
    expect(within(table).getByText("English")).toBeTruthy()
    expect(within(table).getByText("v3")).toBeTruthy()
    expect(within(table).getByText("Not synced")).toBeTruthy()
  })

  it("shows an empty state with a working create link, and a different one for archived", async () => {
    mockApi()
    const user = userEvent.setup()
    const router = renderApp(`/w/${WS}/agents`)

    expect(await screen.findByText("No agents yet")).toBeTruthy()
    const links = screen.getAllByRole("link", { name: "Create agent" })
    expect(links.length).toBe(2)

    await user.click(screen.getByRole("tab", { name: "Archived" }))
    expect(await screen.findByText("No archived agents")).toBeTruthy()
    expect(router.state.location.search).toBe("?status=archived")

    await user.click(links[0]!)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/w/${WS}/agents/new`))
  })
})

describe("create agent", () => {
  it("validates required fields, then posts the form and opens the new agent", async () => {
    const created = agent(version(1, "Be helpful."))
    const fetchMock = mockApi(ME, [
      on("POST", BASE, () => Response.json(created, { status: 201 })),
      on("GET", `${BASE}/${AGENT_ID}`, () => Response.json(created)),
    ])
    const user = userEvent.setup()
    const router = renderApp(`/w/${WS}/agents/new`)

    const submit = await screen.findByRole("button", { name: "Create agent" })
    await user.click(submit)
    expect(await screen.findByText("Give the agent a name")).toBeTruthy()
    expect(screen.getByText("Write a system prompt")).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)

    await user.type(screen.getByLabelText("Name"), "Support bot")
    await user.type(screen.getByLabelText("System prompt"), "Be helpful.")
    await user.click(submit)

    await waitFor(() => expect(router.state.location.pathname).toBe(`/w/${WS}/agents/${AGENT_ID}`))
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      name: "Support bot",
      description: "",
      icon: "",
      visibility: "private",
      config: {
        model: DEFAULT_MODEL_ID,
        language: "en",
        effort: "medium",
        systemPrompt: "Be helpful.",
        actions: [],
      },
    })
    expect(await screen.findByText("Created Support bot")).toBeTruthy()
  })
})

describe("agent detail", () => {
  it("saves an edited configuration and reports the new version", async () => {
    let current = agent(version(1, "Be helpful."))
    const fetchMock = mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () => Response.json(current)),
      on("PATCH", `${BASE}/${AGENT_ID}`, () => {
        const next = version(2, "Be helpful. Be brief.")
        current = agent({ ...next, createdAt: "2026-11-02T10:00:00.000Z" })
        return Response.json(current)
      }),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/agents/${AGENT_ID}`)

    const save = await screen.findByRole("button", { name: "Save changes" })
    expect((save as HTMLButtonElement).disabled).toBe(true)

    await user.type(screen.getByLabelText("System prompt"), " Be brief.")
    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false))
    await user.click(save)

    expect(await screen.findByText("Saved as v2")).toBeTruthy()
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")
    expect(JSON.parse(patch![1]!.body as string)).toEqual({
      name: "Support bot",
      description: "Answers order questions",
      icon: "🤖",
      visibility: "private",
      config: {
        model: DEFAULT_MODEL_ID,
        language: "en",
        effort: "medium",
        systemPrompt: "Be helpful. Be brief.",
        actions: [],
      },
    })
  })

  it("lists versions newest first with the current one marked", async () => {
    const v2 = version(2, "Second prompt")
    const v1 = version(1, "First prompt")
    mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () => Response.json(agent(v2))),
      on("GET", `${BASE}/${AGENT_ID}/versions`, () => Response.json({ versions: [v2, v1] })),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=versions`)

    const list = await screen.findByRole("list", { name: "Versions" })
    const rows = within(list).getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByText("v2")).toBeTruthy()
    expect(within(rows[0]!).getByText("Current")).toBeTruthy()
    expect(within(rows[1]!).queryByText("Current")).toBeNull()

    expect(screen.queryByText("First prompt")).toBeNull()
    await user.click(within(rows[1]!).getByRole("button"))
    expect(screen.getByText("First prompt")).toBeTruthy()
  })

  it("asks for confirmation before archiving, then deletes and returns to the list", async () => {
    const fetchMock = mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () => Response.json(agent(version(1, "Be helpful.")))),
      on("DELETE", `${BASE}/${AGENT_ID}`, () => new Response(null, { status: 204 })),
    ])
    const user = userEvent.setup()
    const router = renderApp(`/w/${WS}/agents/${AGENT_ID}`)

    await user.click(await screen.findByRole("button", { name: "More actions" }))
    await user.click(await screen.findByRole("menuitem", { name: "Archive agent" }))

    const dialog = await screen.findByRole("alertdialog")
    const confirm = within(dialog).getByRole("button", { name: "Archive agent" })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false)

    await user.type(within(dialog).getByLabelText(/to confirm/), "Support bot")
    await user.click(confirm)

    await waitFor(() => expect(router.state.location.pathname).toBe(`/w/${WS}/agents`))
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true)
    expect(await screen.findByText("Agent archived")).toBeTruthy()
  })

  it("shows not found for an unknown agent", async () => {
    mockApi()
    renderApp(`/w/${WS}/agents/${AGENT_ID}`)
    expect(await screen.findByText("Agent not found")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back to agents" })).toBeTruthy()
  })
})

describe("agent actions", () => {
  it("enables a tool to run automatically and saves it as a new version with the same config", async () => {
    let current = agent(version(1, "Be helpful."))
    const fetchMock = mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () => Response.json(current)),
      on("GET", CONNECTIONS, () => Response.json({ connections: [ORDERS] })),
      on("PATCH", `${BASE}/${AGENT_ID}`, () => {
        current = agent({
          ...version(2, "Be helpful.", [
            {
              connectionId: CONN_ID,
              toolName: "lookup_order",
              permission: "auto",
              usageNote: "For order status",
              connectionName: "Orders",
              stale: false,
            },
          ]),
          createdAt: "2026-11-02T10:00:00.000Z",
        })
        return Response.json(current)
      }),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=actions`)

    const save = await screen.findByRole("button", { name: "Save actions" })
    expect((save as HTMLButtonElement).disabled).toBe(true)

    await user.click(screen.getByRole("checkbox", { name: "Enable lookup_order" }))
    const permission = screen.getByRole("radiogroup", { name: "Permission for lookup_order" })
    expect(
      (within(permission).getByRole("radio", { name: /Ask me first/ }) as HTMLInputElement).checked,
    ).toBe(true)
    await user.click(within(permission).getByRole("radio", { name: /Run automatically/ }))
    await user.type(screen.getByLabelText("Usage note"), "For order status")

    // The inputs preview renders the schema's properties as a table.
    await user.click(screen.getAllByRole("button", { name: "Inputs" })[0]!)
    expect(screen.getByRole("table", { name: "Inputs of lookup_order" })).toBeTruthy()
    expect(screen.getByText("order_id")).toBeTruthy()

    await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(false))
    await user.click(save)

    // Sonner keeps its toasts in module state, so an earlier test's "Saved as v2" may still be
    // listed: the header badge is what proves this save produced the new version.
    expect((await screen.findAllByText("Saved as v2")).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getAllByText("v2").length).toBeGreaterThan(0))
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")
    expect(JSON.parse(patch![1]!.body as string)).toEqual({
      config: {
        model: DEFAULT_MODEL_ID,
        language: "en",
        effort: "medium",
        systemPrompt: "Be helpful.",
        actions: [
          {
            connectionId: CONN_ID,
            toolName: "lookup_order",
            permission: "auto",
            usageNote: "For order status",
          },
        ],
      },
    })
  })

  it("keeps existing actions when the configuration is saved", async () => {
    const existing = {
      connectionId: CONN_ID,
      toolName: "refund_order",
      permission: "ask" as const,
      usageNote: "Only when asked",
    }
    const fetchMock = mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () =>
        Response.json(
          agent(
            version(1, "Be helpful.", [{ ...existing, connectionName: "Orders", stale: false }]),
          ),
        ),
      ),
      on("PATCH", `${BASE}/${AGENT_ID}`, () =>
        Response.json(agent(version(2, "Be helpful. Be brief."))),
      ),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/agents/${AGENT_ID}`)

    await user.type(await screen.findByLabelText("System prompt"), " Be brief.")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true),
    )
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")
    const body = JSON.parse(patch![1]!.body as string) as { config: { actions: unknown } }
    expect(body.config.actions).toEqual([existing])
  })

  it("warns about a stale action and lets you remove it", async () => {
    const fetchMock = mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () =>
        Response.json(
          agent(
            version(1, "Be helpful.", [
              {
                connectionId: CONN_ID,
                toolName: "cancel_order",
                permission: "ask",
                usageNote: "",
                connectionName: "Orders",
                stale: true,
              },
            ]),
          ),
        ),
      ),
      on("GET", CONNECTIONS, () => Response.json({ connections: [ORDERS] })),
      on("PATCH", `${BASE}/${AGENT_ID}`, () => Response.json(agent(version(2, "Be helpful.")))),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=actions`)

    expect(await screen.findByText("1 action is no longer offered by its connection")).toBeTruthy()
    const stale = screen.getByRole("list", { name: "Stale actions" })
    expect(within(stale).getByText("cancel_order")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Remove cancel_order" }))
    expect(screen.queryByText("1 action is no longer offered by its connection")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Save actions" }))

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true),
    )
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")
    const body = JSON.parse(patch![1]!.body as string) as { config: { actions: unknown } }
    expect(body.config.actions).toEqual([])
  })

  it("points to the Connections page when the workspace has none", async () => {
    mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () => Response.json(agent(version(1, "Be helpful.")))),
      on("GET", CONNECTIONS, () => Response.json({ connections: [] })),
    ])
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=actions`)

    const link = await screen.findByRole("link", { name: "Go to Connections" })
    expect(link.getAttribute("href")).toBe(`/w/${WS}/connections`)
  })

  it("is read-only for an archived agent", async () => {
    mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () =>
        Response.json(agent(version(1, "Be helpful."), { status: "archived" })),
      ),
      on("GET", CONNECTIONS, () => Response.json({ connections: [ORDERS] })),
    ])
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=actions`)

    const checkbox = await screen.findByRole("checkbox", { name: "Enable lookup_order" })
    expect((checkbox as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole("button", { name: "Save actions" })).toBeNull()
  })

  it("shows each version's actions in the versions list", async () => {
    const v1 = version(1, "First prompt", [
      {
        connectionId: CONN_ID,
        toolName: "lookup_order",
        permission: "auto",
        usageNote: "",
        connectionName: "Orders",
        stale: false,
      },
    ])
    mockApi(ME, [
      on("GET", `${BASE}/${AGENT_ID}`, () => Response.json(agent(v1))),
      on("GET", `${BASE}/${AGENT_ID}/versions`, () => Response.json({ versions: [v1] })),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/agents/${AGENT_ID}?tab=versions`)

    const list = await screen.findByRole("list", { name: "Versions" })
    expect(within(list).getByText("1 action")).toBeTruthy()
    await user.click(within(list).getByRole("button"))
    const actions = screen.getByRole("list", { name: "Actions of v1" })
    expect(within(actions).getByText("lookup_order")).toBeTruthy()
    expect(within(actions).getByText("Run automatically")).toBeTruthy()
  })
})
