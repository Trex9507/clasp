import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ME, mockApi, renderApp } from "@/test/render-app"

const [PERSONAL, ORG] = ME.workspaces as [(typeof ME.workspaces)[0], (typeof ME.workspaces)[0]]

afterEach(() => {
  vi.unstubAllGlobals()
  try {
    localStorage.clear()
  } catch {
    // jsdom without storage: nothing to clear.
  }
})

describe("routing", () => {
  it("redirects / to the first workspace's agents page", async () => {
    mockApi()
    const router = renderApp("/")

    await waitFor(() => expect(router.state.location.pathname).toBe(`/w/${PERSONAL.id}/agents`))
    expect(await screen.findByRole("heading", { level: 1, name: "Agents" })).toBeTruthy()
    expect(await screen.findByText("No agents yet")).toBeTruthy()
  })

  it("shows an empty state when the user has no workspace", async () => {
    mockApi({ ...ME, workspaces: [] })
    renderApp("/")
    expect(await screen.findByText("No workspace yet")).toBeTruthy()
  })

  it("says so when the workspace in the URL is not one of the user's", async () => {
    mockApi()
    renderApp("/w/33333333-3333-4333-8333-333333333333/agents")
    expect(await screen.findByText("Workspace not found")).toBeTruthy()
  })

  it("renders the API's error detail when /me fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "Database unavailable." }, { status: 503 })),
    )
    renderApp("/")
    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("Database unavailable.")).toBeTruthy()
  })
})

describe("workspace switcher", () => {
  it("lists the workspaces from /me and keeps the section when switching", async () => {
    mockApi()
    const user = userEvent.setup()
    const router = renderApp(`/w/${PERSONAL.id}/connections`)

    const trigger = await screen.findByRole("button", {
      name: `Workspace: ${PERSONAL.name}. Switch workspace`,
    })
    await user.click(trigger)

    // React Aria labels the menu by its trigger, so it is found by role alone.
    const menu = await screen.findByRole("menu")
    const items = within(menu).getAllByRole("menuitemradio")
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining(PERSONAL.name),
      expect.stringContaining(ORG.name),
    ])

    await user.click(items[1]!)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/w/${ORG.id}/connections`))
  })
})
