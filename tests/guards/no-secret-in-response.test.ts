// CLAUDE.md rule 2: no secret leaves the server. No schema in the shared API contract may carry
// a field that looks like a credential; responses say `hasCredential` instead.
import { describe, expect, it } from "vitest"
import type { ZodType } from "zod"
import * as contract from "../../packages/shared/src/api.js"

// Token-shaped names (token, accessToken, refresh_token), not usage counts like inputTokens.
const SECRET_KEY =
  /secret|password|credential|bearer|api_?key|private_?key|(^|access|refresh|auth|session|id)_?token$/i
const ALLOWED_KEYS = new Set(["hasCredential"])

function keysOf(schema: ZodType, path: string, out: string[]): void {
  const def = (schema as unknown as { _zod?: { def?: Record<string, unknown> } })._zod?.def
  if (!def) return
  const inner = (def.innerType ?? def.element ?? def.in) as ZodType | undefined
  if (inner) keysOf(inner, path, out)
  for (const option of (def.options as ZodType[] | undefined) ?? []) keysOf(option, path, out)
  const shape = def.shape as Record<string, ZodType> | undefined
  if (shape) {
    for (const [key, value] of Object.entries(shape)) {
      out.push(`${path}.${key}`)
      keysOf(value, `${path}.${key}`, out)
    }
  }
}

describe("no secret in response guard", () => {
  // `*Request` schemas describe what the client sends; a secret may come in, never go out.
  const schemas = Object.entries(contract)
    .filter(([name]) => !name.endsWith("Request"))
    .filter(
      (entry): entry is [string, ZodType] =>
        typeof (entry[1] as { safeParse?: unknown }).safeParse === "function",
    )

  it("inspects the contract's schemas", () => {
    expect(schemas.length).toBeGreaterThan(0)
  })

  it("has no credential-like field in any contract schema", () => {
    const keys: string[] = []
    for (const [name, schema] of schemas) keysOf(schema, name, keys)
    const leaks = keys.filter((k) => {
      const field = k.split(".").pop() ?? ""
      return SECRET_KEY.test(field) && !ALLOWED_KEYS.has(field)
    })
    expect(leaks).toEqual([])
  })
})
