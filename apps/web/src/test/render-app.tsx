import type { MeResponse } from "@clasp/shared"
import { render } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { vi } from "vitest"

import { routes } from "@/app-routes"
import { createQueryClient } from "@/lib/query-client"
import { Providers } from "@/providers"

export const ME: MeResponse = {
  user: {
    id: "8a1d2f4e-6b3c-4d5e-8f90-1a2b3c4d5e6f",
    email: "ada@example.com",
    name: "Ada Lovelace",
  },
  workspaces: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Ada's workspace",
      kind: "personal",
      role: "owner",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Analytical Engines Ltd",
      kind: "organization",
      role: "member",
    },
  ],
}

/** Stubs `fetch` so `/api/v1/me` answers with `me` and anything else is a 404. */
export function mockApi(me: MeResponse = ME) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()
    if (url.endsWith("/api/v1/me")) return Response.json(me)
    return Response.json({ detail: "Not found." }, { status: 404 })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

/** Mounts the real route table at `path`, with a fresh query cache. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({ queries: { retry: false } })
  render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}
