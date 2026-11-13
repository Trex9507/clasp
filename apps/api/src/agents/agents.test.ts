import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { createForeignWorkspace, useTestApp } from "../test/harness.js"

const t = useTestApp()

const CONFIG = {
  model: "anthropic/claude-sonnet-5-5",
  language: "it",
  effort: "medium",
  systemPrompt: "You qualify inbound sales leads.",
} as const

async function personalWorkspace(): Promise<string> {
  const me = (await t.app.inject({ method: "GET", url: "/api/v1/me" })).json()
  return me.workspaces[0].id
}

async function createAgent(ws: string, body: Record<string, unknown> = {}) {
  return t.app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${ws}/agents`,
    payload: { name: "Lead qualifier", config: CONFIG, ...body },
  })
}

describe("agents", () => {
  it("creates an agent at v1 and hosts it on the runtime", async () => {
    const ws = await personalWorkspace()
    const res = await createAgent(ws, { description: "Qualifies leads", icon: "🎯" })
    expect(res.statusCode).toBe(201)
    const agent = res.json()
    expect(agent).toMatchObject({
      name: "Lead qualifier",
      description: "Qualifies leads",
      icon: "🎯",
      status: "active",
      visibility: "private",
      currentVersion: { version: 1, ...CONFIG, runtimeSynced: true },
    })
    expect(agent.currentVersion.createdBy.email).toBe("dev@clasp.local")
    const [hosted] = [...t.runtime.agents.values()]
    expect(hosted?.versions[0]?.system).toContain("Always respond in Italian")
  })

  it("rejects an invalid agent with a 422 detail", async () => {
    const ws = await personalWorkspace()
    const noPrompt = await createAgent(ws, { config: { ...CONFIG, systemPrompt: "  " } })
    expect(noPrompt.statusCode).toBe(422)
    expect(noPrompt.json().detail).toContain("systemPrompt")
    const badModel = await createAgent(ws, { config: { ...CONFIG, model: "gpt-9" } })
    expect(badModel.statusCode).toBe(422)
  })

  it("versions config changes only, newest first", async () => {
    const ws = await personalWorkspace()
    const { id } = (await createAgent(ws)).json()
    const url = `/api/v1/workspaces/${ws}/agents/${id}`

    const same = await t.app.inject({ method: "PATCH", url, payload: { config: CONFIG } })
    expect(same.json().currentVersion.version).toBe(1)

    const renamed = await t.app.inject({ method: "PATCH", url, payload: { name: "Qualifier" } })
    expect(renamed.json()).toMatchObject({ name: "Qualifier", currentVersion: { version: 1 } })

    const changed = await t.app.inject({
      method: "PATCH",
      url,
      payload: { config: { ...CONFIG, effort: "high" } },
    })
    expect(changed.json().currentVersion).toMatchObject({
      version: 2,
      effort: "high",
      runtimeSynced: true,
    })

    const versions = (await t.app.inject({ method: "GET", url: `${url}/versions` })).json().versions
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1])
    expect(versions[1].effort).toBe("medium")
  })

  it("gives concurrent saves consecutive version numbers", async () => {
    const ws = await personalWorkspace()
    const { id } = (await createAgent(ws)).json()
    const url = `/api/v1/workspaces/${ws}/agents/${id}`
    const saves = await Promise.all(
      ["low", "high"].map((effort) =>
        t.app.inject({ method: "PATCH", url, payload: { config: { ...CONFIG, effort } } }),
      ),
    )
    expect(saves.map((r) => r.statusCode)).toEqual([200, 200])
    const versions = (await t.app.inject({ method: "GET", url: `${url}/versions` })).json().versions
    expect(versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1])
  })

  it("lists active and archived agents separately", async () => {
    const ws = await personalWorkspace()
    const a = (await createAgent(ws, { name: "Alpha" })).json()
    await createAgent(ws, { name: "Beta" })
    await t.app.inject({ method: "DELETE", url: `/api/v1/workspaces/${ws}/agents/${a.id}` })

    const active = (
      await t.app.inject({ method: "GET", url: `/api/v1/workspaces/${ws}/agents` })
    ).json()
    expect(active.agents.map((x: { name: string }) => x.name)).toEqual(["Beta"])
    expect(active.agents[0]).toMatchObject({ version: 1, actionCount: 0, runtimeSynced: true })

    const archived = (
      await t.app.inject({ method: "GET", url: `/api/v1/workspaces/${ws}/agents?status=archived` })
    ).json()
    expect(archived.agents.map((x: { name: string }) => x.name)).toEqual(["Alpha"])
  })

  it("archives permanently: runtime retired, edits refused, repeat is a no-op", async () => {
    const ws = await personalWorkspace()
    const { id } = (await createAgent(ws)).json()
    const url = `/api/v1/workspaces/${ws}/agents/${id}`

    expect((await t.app.inject({ method: "DELETE", url })).statusCode).toBe(204)
    expect([...t.runtime.agents.values()][0]?.archived).toBe(true)
    expect((await t.app.inject({ method: "GET", url })).json().status).toBe("archived")

    const edit = await t.app.inject({ method: "PATCH", url, payload: { name: "Nope" } })
    expect(edit.statusCode).toBe(409)
    expect((await t.app.inject({ method: "DELETE", url })).statusCode).toBe(204)
  })

  it("keeps the save when the runtime is down, and syncs on retry", async () => {
    const ws = await personalWorkspace()
    t.runtime.failNext = "runtime unavailable"
    const created = await createAgent(ws)
    expect(created.statusCode).toBe(201)
    expect(created.json().currentVersion.runtimeSynced).toBe(false)

    const url = `/api/v1/workspaces/${ws}/agents/${created.json().id}`
    const synced = await t.app.inject({ method: "POST", url: `${url}/sync` })
    expect(synced.json().currentVersion.runtimeSynced).toBe(true)
  })

  it("answers 404 for another workspace's agents", async () => {
    const foreignWs = await createForeignWorkspace(t.db)
    const list = await t.app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${foreignWs}/agents`,
    })
    expect(list.statusCode).toBe(404)

    // An agent in the dev user's workspace is invisible through the foreign workspace's URL.
    const ws = await personalWorkspace()
    const { id } = (await createAgent(ws)).json()
    const crossed = await t.app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${foreignWs}/agents/${id}`,
    })
    expect(crossed.statusCode).toBe(404)
    const missing = await t.app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${ws}/agents/00000000-0000-4000-8000-000000000000`,
    })
    expect(missing.json()).toEqual({ detail: "Agent not found" })
  })
})

describe("agent_versions immutability (I2)", () => {
  it("rejects changing a saved version's configuration", async () => {
    const ws = await personalWorkspace()
    await createAgent(ws)
    // Drizzle wraps the driver error; the trigger's message is on the cause.
    const error = await t.db
      .execute(sql`UPDATE agent_versions SET system_prompt = 'tampered'`)
      .then(
        () => undefined,
        (e: Error) => e,
      )
    expect(String((error?.cause as Error | undefined)?.message)).toMatch(/immutable/)
  })

  it("allows recording the runtime sync", async () => {
    const ws = await personalWorkspace()
    await createAgent(ws)
    await expect(
      t.db.execute(sql`UPDATE agent_versions SET runtime_synced_version = 7`),
    ).resolves.toBeDefined()
  })
})
