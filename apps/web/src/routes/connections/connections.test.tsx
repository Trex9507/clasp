import type { McpConnection } from "@clasp/shared"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ME, mockApi, renderApp, type MockHandler } from "@/test/render-app"

const WS = ME.workspaces[0]!.id
const BASE = `/api/v1/workspaces/${WS}/mcp-connections`
const ORDERS_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const CRM_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

const ORDERS: McpConnection = {
  id: ORDERS_ID,
  name: "Orders",
  url: "https://orders.example.com/mcp",
  authType: "bearer",
  hasCredential: true,
  status: "ok",
  lastError: null,
  lastCheckedAt: "2026-11-01T10:00:00.000Z",
  tools: [
    { name: "lookup_order", description: "Finds an order by its id.", inputSchema: {} },
    { name: "refund_order", description: "Refunds an order.", inputSchema: {} },
  ],
  usedBy: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Support bot" }],
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
}

const CRM: McpConnection = {
  ...ORDERS,
  id: CRM_ID,
  name: "CRM",
  url: "https://crm.example.com/mcp",
  authType: "none",
  hasCredential: false,
  status: "error",
  lastError: "Connection refused",
  tools: [],
  usedBy: [],
}

function on(method: string, path: string, respond: (body: unknown) => Response): MockHandler {
  return (request) =>
    request.method === method && request.path === path ? respond(request.body) : undefined
}

function sent(fetchMock: ReturnType<typeof mockApi>, method: string) {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === method)
  return call ? (JSON.parse((call[1]?.body as string | undefined) ?? "null") as unknown) : undefined
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("connections list", () => {
  it("renders each connection with its status, auth, tools and usage", async () => {
    mockApi(ME, [on("GET", BASE, () => Response.json({ connections: [ORDERS, CRM] }))])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/connections`)

    const orders = await screen.findByRole("group", { name: "Orders" })
    expect(within(orders).getByText("https://orders.example.com/mcp")).toBeTruthy()
    expect(within(orders).getByText("Connected")).toBeTruthy()
    expect(within(orders).getByText("Bearer token")).toBeTruthy()
    expect(within(orders).getByText("2 tools")).toBeTruthy()
    expect(within(orders).getByText("Used by 1 agent")).toBeTruthy()

    const crm = screen.getByRole("group", { name: "CRM" })
    expect(within(crm).getByText("Error")).toBeTruthy()
    expect(within(crm).getByText("Connection refused")).toBeTruthy()
    expect(within(crm).getByText("No auth")).toBeTruthy()
    expect(within(crm).getByText("Not used by any agent")).toBeTruthy()

    expect(screen.queryByText("lookup_order")).toBeNull()
    await user.click(within(orders).getByRole("button", { name: "Show tools" }))
    const tools = within(orders).getByRole("list", { name: "Tools of Orders" })
    expect(within(tools).getByText("lookup_order")).toBeTruthy()
    expect(within(tools).getByText("Refunds an order.")).toBeTruthy()
  })

  it("shows the empty state with a call to action", async () => {
    mockApi(ME, [on("GET", BASE, () => Response.json({ connections: [] }))])
    renderApp(`/w/${WS}/connections`)

    expect(await screen.findByText("No connections yet")).toBeTruthy()
    expect(screen.getByText(/tools it exposes become actions/)).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Add connection" })).toHaveLength(2)
  })

  it("tests a connection and reports what it found", async () => {
    const fetchMock = mockApi(ME, [
      on("GET", BASE, () => Response.json({ connections: [ORDERS] })),
      on("POST", `${BASE}/${ORDERS_ID}/discover`, () => Response.json(ORDERS)),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/connections`)

    await user.click(await screen.findByRole("button", { name: "Test & discover" }))
    expect(await screen.findByText("Checked Orders")).toBeTruthy()
    expect(screen.getByText("Found 2 tools.")).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true)
  })
})

describe("add connection", () => {
  it("validates the URL and the bearer token, then posts the right body", async () => {
    const created: McpConnection = {
      ...ORDERS,
      id: CRM_ID,
      name: "Billing",
      url: "https://billing.example.com/mcp",
      usedBy: [],
    }
    const fetchMock = mockApi(ME, [
      on("GET", BASE, () => Response.json({ connections: [] })),
      on("POST", BASE, () => Response.json(created, { status: 201 })),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/connections`)

    await user.click((await screen.findAllByRole("button", { name: "Add connection" }))[0]!)
    const dialog = await screen.findByRole("dialog")
    const submit = within(dialog).getByRole("button", { name: "Add and test" })

    await user.click(submit)
    expect(await within(dialog).findByText("Name the connection")).toBeTruthy()
    expect(within(dialog).getByText("Enter an http(s) URL")).toBeTruthy()

    await user.type(within(dialog).getByLabelText("Name"), "Billing")
    await user.type(within(dialog).getByLabelText("URL"), "ftp://billing.example.com")
    await user.click(within(dialog).getByRole("radio", { name: "Bearer token" }))
    await user.click(submit)
    expect(await within(dialog).findByText("Paste the bearer token")).toBeTruthy()
    expect(within(dialog).getByText("Enter an http(s) URL")).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)

    const url = within(dialog).getByLabelText("URL")
    await user.clear(url)
    await user.type(url, "https://billing.example.com/mcp")
    const token = within(dialog).getByLabelText("Token")
    expect(token.getAttribute("type")).toBe("password")
    await user.type(token, "s3cret")
    await user.click(submit)

    expect(await screen.findByText("Connected Billing")).toBeTruthy()
    expect(sent(fetchMock, "POST")).toEqual({
      name: "Billing",
      url: "https://billing.example.com/mcp",
      authType: "bearer",
      bearerToken: "s3cret",
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("edits without resending the saved token when left blank", async () => {
    const fetchMock = mockApi(ME, [
      on("GET", BASE, () => Response.json({ connections: [ORDERS] })),
      on("PATCH", `${BASE}/${ORDERS_ID}`, () => Response.json({ ...ORDERS, name: "Orders v2" })),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/connections`)

    await user.click(await screen.findByRole("button", { name: "More actions for Orders" }))
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }))
    const dialog = await screen.findByRole("dialog")
    const token = within(dialog).getByLabelText("Token")
    expect((token as HTMLInputElement).value).toBe("")
    expect(token.getAttribute("placeholder")).toBe("Leave blank to keep the saved token")

    await user.type(within(dialog).getByLabelText("Name"), " v2")
    await user.click(within(dialog).getByRole("button", { name: "Save and test" }))

    expect(await screen.findByText("Saved Orders v2")).toBeTruthy()
    expect(sent(fetchMock, "PATCH")).toEqual({
      name: "Orders v2",
      url: "https://orders.example.com/mcp",
      authType: "bearer",
    })
  })
})

describe("delete connection", () => {
  it("confirms, then shows why the API refused when agents still use it", async () => {
    const detail = "Orders is used by Support bot. Remove its actions first."
    const fetchMock = mockApi(ME, [
      on("GET", BASE, () => Response.json({ connections: [ORDERS] })),
      on("DELETE", `${BASE}/${ORDERS_ID}`, () => Response.json({ detail }, { status: 409 })),
    ])
    const user = userEvent.setup()
    renderApp(`/w/${WS}/connections`)

    await user.click(await screen.findByRole("button", { name: "More actions for Orders" }))
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/used by Support bot/)).toBeTruthy()
    const confirm = within(dialog).getByRole("button", { name: "Delete connection" })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    await user.type(within(dialog).getByLabelText(/to confirm/), "Orders")
    await user.click(confirm)

    expect(await screen.findByText("Could not delete the connection")).toBeTruthy()
    expect(screen.getByText(detail)).toBeTruthy()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true)
  })
})
