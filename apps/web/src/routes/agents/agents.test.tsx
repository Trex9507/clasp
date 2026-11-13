import { DEFAULT_MODEL_ID, type Agent, type AgentSummary, type AgentVersion } from "@clasp/shared"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ME, mockApi, type MockHandler } from "@/test/render-app"
import { renderApp } from "@/test/render-app"

const WS = ME.workspaces[0]!.id
const AGENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const BASE = `/api/v1/workspaces/${WS}/agents`

function version(n: number, systemPrompt: string): AgentVersion {
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-00000000000${n}`,
    version: n,
    model: DEFAULT_MODEL_ID,
    language: "en",
    effort: "medium",
    systemPrompt,
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
