import { eq } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"
import type { RunEvent } from "@clasp/shared"
import { agentRuns } from "../db/schema.js"
import { createForeignWorkspace, useTestApp } from "../test/harness.js"
import { startTestMcpServer, type TestMcpServer } from "../test/mcp-server.js"

const t = useTestApp()
const servers: TestMcpServer[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()))
})

const CONFIG = {
  model: "anthropic/claude-sonnet-5-5",
  language: "en",
  effort: "medium",
  systemPrompt: "You qualify inbound sales leads.",
}

async function setup(actions: { toolName: string; permission: "ask" | "auto" }[] = []) {
  const ws = (await t.app.inject({ method: "GET", url: "/api/v1/me" })).json().workspaces[0].id
  let connectionId: string | undefined
  if (actions.length > 0) {
    const crm = await startTestMcpServer()
    servers.push(crm)
    connectionId = (
      await t.app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${ws}/mcp-connections`,
        payload: { name: "CRM", url: crm.url },
      })
    ).json().id
  }
  const agent = (
    await t.app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${ws}/agents`,
      payload: {
        name: "Lead qualifier",
        config: { ...CONFIG, actions: actions.map((a) => ({ ...a, connectionId })) },
      },
    })
  ).json()
  const run = await t.app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${ws}/agents/${agent.id}/runs`,
  })
  return { ws, agent, run }
}

const listening = new WeakMap<object, Promise<string>>()
/** Each test gets a fresh app; listen once per app and reuse its address. */
function addressOf(app: typeof t.app): Promise<string> {
  let address = listening.get(app)
  if (!address) {
    address = app.listen({ port: 0, host: "127.0.0.1" })
    listening.set(app, address)
  }
  return address
}

/** Reads a run's SSE stream over real HTTP until `stop` says enough. */
async function readStream(ws: string, runId: string, stop: (events: RunEvent[]) => boolean) {
  const address = await addressOf(t.app)
  const controller = new AbortController()
  const res = await fetch(`${address}/api/v1/workspaces/${ws}/runs/${runId}/events`, {
    signal: controller.signal,
  })
  expect(res.headers.get("content-type")).toContain("text/event-stream")
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  const events: RunEvent[] = []
  let buffer = ""
  try {
    while (!stop(events)) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let split: number
      while ((split = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, split)
        buffer = buffer.slice(split + 2)
        const data = block.split("\n").find((l) => l.startsWith("data: "))
        if (data) events.push(JSON.parse(data.slice(6)) as RunEvent)
      }
    }
  } finally {
    controller.abort()
  }
  return events
}

const lastStatus = (events: RunEvent[]) =>
  events.filter((e) => e.kind === "status").at(-1) as
    Extract<RunEvent, { kind: "status" }> | undefined

describe("runs", () => {
  it("reports the simulated runtime", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/v1/platform" })
    expect(res.json()).toEqual({ runtime: { provider: "fake", simulated: true } })
  })

  it("starts a run pinned to the agent's current version", async () => {
    const { ws, agent, run } = await setup()
    expect(run.statusCode).toBe(201)
    expect(run.json()).toMatchObject({
      agentId: agent.id,
      agentVersion: 1,
      status: "idle",
      budgetCents: 100,
      events: [],
      usage: { costCents: 0 },
    })
    const list = await t.app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${ws}/agents/${agent.id}/runs`,
    })
    expect(list.json().runs.map((r: { id: string }) => r.id)).toEqual([run.json().id])
  })

  it("streams a conversation and records usage on the ledger", async () => {
    const { ws, run } = await setup()
    const runId = run.json().id
    const streaming = readStream(
      ws,
      runId,
      (events) => lastStatus(events)?.status === "idle" && events.some((e) => e.kind === "usage"),
    )
    // Give the stream a moment to open, as the web app does by waiting for `open`.
    await new Promise((r) => setTimeout(r, 50))
    const sent = await t.app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${ws}/runs/${runId}/messages`,
      payload: { text: "Hello agent" },
    })
    expect(sent.statusCode).toBe(204)
    const events = await streaming

    expect(events.find((e) => e.kind === "user_message")).toMatchObject({ text: "Hello agent" })
    expect(events.find((e) => e.kind === "agent_message")).toMatchObject({
      text: "[Simulated] You said: Hello agent",
    })
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length)

    const [row] = await t.db.select().from(agentRuns).where(eq(agentRuns.id, runId))
    expect(row?.status).toBe("idle")
    expect(row?.usage.outputTokens).toBeGreaterThan(0)

    // Reconnecting replays the history once.
    const replay = await readStream(ws, runId, (e) => e.some((x) => x.kind === "agent_message"))
    expect(replay.filter((e) => e.kind === "agent_message")).toHaveLength(1)
  })

  it("pauses for approval on an ask action and continues after it", async () => {
    const { ws, run } = await setup([{ toolName: "create_lead", permission: "ask" }])
    const runId = run.json().id
    const url = `/api/v1/workspaces/${ws}/runs/${runId}`
    const waiting = readStream(ws, runId, (e) => lastStatus(e)?.status === "awaiting_approval")
    await new Promise((r) => setTimeout(r, 50))
    await t.app.inject({
      method: "POST",
      url: `${url}/messages`,
      payload: { text: "create_lead for Acme" },
    })
    const paused = await waiting
    const call = paused.find((e) => e.kind === "tool_call")
    expect(call).toMatchObject({
      toolName: "create_lead",
      connectionName: "CRM",
      permission: "ask",
    })
    expect(lastStatus(paused)?.pendingToolCallIds).toEqual([call!.id])

    const blocked = await t.app.inject({
      method: "POST",
      url: `${url}/messages`,
      payload: { text: "hi?" },
    })
    expect(blocked.statusCode).toBe(409)

    const resumed = readStream(ws, runId, (e) => e.some((x) => x.kind === "tool_result"))
    await new Promise((r) => setTimeout(r, 50))
    const decided = await t.app.inject({
      method: "POST",
      url: `${url}/tool-decisions`,
      payload: { toolCallId: call!.id, decision: "allow" },
    })
    expect(decided.statusCode).toBe(204)
    const after = await resumed
    expect(after.find((e) => e.kind === "tool_decision")).toMatchObject({ decision: "allow" })
    expect(after.find((e) => e.kind === "tool_result")).toMatchObject({
      toolCallId: call!.id,
      isError: false,
    })

    const full = (await t.app.inject({ method: "GET", url })).json()
    expect(full.events.map((e: RunEvent) => e.kind)).toContain("tool_result")
  })

  it("re-hosts the agent when the runtime lost it", async () => {
    const { ws, agent } = await setup()
    t.runtime.agents.clear() // as after a restart of the in-memory runtime
    const run = await t.app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${ws}/agents/${agent.id}/runs`,
    })
    expect(run.statusCode).toBe(201)
    expect(t.runtime.agents.size).toBe(1)
  })

  it("answers 502 with a detail when the runtime keeps failing", async () => {
    const { ws, run } = await setup()
    t.runtime.failNext = "runtime is down"
    const res = await t.app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${ws}/runs/${run.json().id}`,
    })
    expect(res.statusCode).toBe(502)
    expect(res.json()).toEqual({ detail: "runtime is down" })
  })

  it("refuses archived agents and hides other workspaces' runs", async () => {
    const { ws, agent, run } = await setup()
    const foreign = await createForeignWorkspace(t.db)
    const hidden = await t.app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${foreign}/runs/${run.json().id}`,
    })
    expect(hidden.statusCode).toBe(404)
    const stream = await t.app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${ws}/runs/00000000-0000-4000-8000-000000000000/events`,
    })
    expect(stream.statusCode).toBe(404)
    expect(stream.json()).toEqual({ detail: "Run not found" })

    await t.app.inject({ method: "DELETE", url: `/api/v1/workspaces/${ws}/agents/${agent.id}` })
    const archived = await t.app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${ws}/agents/${agent.id}/runs`,
    })
    expect(archived.statusCode).toBe(409)
  })
})
