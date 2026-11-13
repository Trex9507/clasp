import { DEFAULT_MODEL_ID, MODELS, type MeResponse } from "@clasp/shared"
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

/** One request as a handler sees it: method, path (no origin) with query, and the parsed body. */
export type MockRequest = { method: string; path: string; body: unknown }

/** Answers a request it recognises, or returns undefined to let the next handler try. */
export type MockHandler = (request: MockRequest) => Response | undefined

/**
 * Stubs `fetch`. `handlers` are tried first, in order; then `/api/v1/me` answers with `me`,
 * `/api/v1/models` with the shared catalog, an agent list with no agents, and anything else
 * is a 404.
 */
export function mockApi(me: MeResponse = ME, handlers: MockHandler[] = []) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    const path = url.replace(/^https?:\/\/[^/]+/, "")
    const method = (init?.method ?? "GET").toUpperCase()
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
    for (const handler of handlers) {
      const response = handler({ method, path, body })
      if (response) return response
    }
    if (method === "GET" && path === "/api/v1/me") return Response.json(me)
    if (method === "GET" && path === "/api/v1/models") {
      return Response.json({ models: MODELS, defaultModelId: DEFAULT_MODEL_ID })
    }
    if (method === "GET" && /^\/api\/v1\/workspaces\/[^/]+\/agents(\?.*)?$/.test(path)) {
      return Response.json({ agents: [] })
    }
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
