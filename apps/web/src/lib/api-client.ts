import type { z } from "zod"

/**
 * A small typed fetch client for the Clasp API.
 *
 * URLs are relative (`/api/v1/...`): in development Vite proxies `/api` to the local API, and
 * in production the web app is served from the same origin. `VITE_API_BASE_URL` overrides the
 * prefix for setups where the API lives elsewhere. It is a URL, not a secret.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ""

/** A failed request, carrying the HTTP status and the API's `detail` message. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

async function readDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === "object" && body !== null && "detail" in body) {
      const { detail } = body as { detail: unknown }
      if (typeof detail === "string") return detail
    }
  } catch {
    // Not JSON: fall through to the status line.
  }
  return `Request failed with status ${response.status}.`
}

/**
 * GET a path and validate the response with its zod schema.
 *
 * Validation is the boundary check (CLAUDE.md, section 5): a response that does not match the
 * shared contract fails loudly here rather than as an undefined field deep in a component.
 */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  })
  if (!response.ok) throw new ApiError(response.status, await readDetail(response))
  const body: unknown = await response.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(response.status, `Unexpected response from ${path}.`)
  }
  return parsed.data
}

/**
 * Turn whatever a failed request produced into one renderable line.
 *
 * Every error the API returns is `{ detail: string }`, so one reader covers them all.
 */
export function errorDetail(error: unknown): string {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const { detail } = error as { detail: unknown }
    if (typeof detail === "string") return detail
  }
  if (error instanceof TypeError) return "Could not reach the Clasp API. Is it running?"
  if (error instanceof Error) return error.message
  return "Something went wrong reaching the Clasp API."
}

/** The HTTP status behind a failed request, where there was one. */
export function errorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const { status } = error as { status: unknown }
    if (typeof status === "number") return status
  }
  return undefined
}
