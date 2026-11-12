import { describe, expect, it } from "vitest"
import { MODELS, DEFAULT_MODEL_ID } from "@clasp/shared"
import { createForeignWorkspace, DEV_EMAIL, useTestApp } from "../../test/harness.js"

const t = useTestApp()

describe("GET /api/v1/me", () => {
  it("returns the dev user and their personal workspace", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/v1/me" })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user).toMatchObject({ id: t.devUserId, email: DEV_EMAIL, name: "Dev User" })
    expect(body.workspaces).toEqual([
      expect.objectContaining({ name: "Personal", kind: "personal", role: "owner" }),
    ])
  })

  it("does not list workspaces the user is not a member of", async () => {
    await createForeignWorkspace(t.db)
    const res = await t.app.inject({ method: "GET", url: "/api/v1/me" })
    expect(res.json().workspaces).toHaveLength(1)
  })
})

describe("GET /api/v1/models", () => {
  it("returns the catalog and its default", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/v1/models" })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ models: [...MODELS], defaultModelId: DEFAULT_MODEL_ID })
  })
})

describe("GET /api/v1/workspaces/:workspaceId", () => {
  it("returns a workspace the user belongs to", async () => {
    const me = (await t.app.inject({ method: "GET", url: "/api/v1/me" })).json()
    const id = me.workspaces[0].id
    const res = await t.app.inject({ method: "GET", url: `/api/v1/workspaces/${id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id, role: "owner" })
  })

  it("answers 404 for another user's workspace, same as a missing one", async () => {
    const foreign = await createForeignWorkspace(t.db)
    const res = await t.app.inject({ method: "GET", url: `/api/v1/workspaces/${foreign}` })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ detail: "Workspace not found" })
  })

  it("answers 422 with a detail for a malformed ID", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/v1/workspaces/not-a-uuid" })
    expect(res.statusCode).toBe(422)
    expect(res.json().detail).toContain("workspaceId")
  })
})

describe("errors and health", () => {
  it("answers unknown routes with a 404 detail", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/v1/nope" })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ detail: "Not found" })
  })

  it("serves /health", async () => {
    const res = await t.app.inject({ method: "GET", url: "/health" })
    expect(res.json()).toEqual({ status: "ok" })
  })
})
