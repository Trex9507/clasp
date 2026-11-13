import { eq } from "drizzle-orm"
import { afterEach, describe, expect, it } from "vitest"
import { mcpConnections } from "../db/schema.js"
import { startTestMcpServer, type TestMcpServer } from "../test/mcp-server.js"
import { useTestApp } from "../test/harness.js"
import { discoverTools } from "./discovery.js"

const t = useTestApp()
const servers: TestMcpServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()))
})

async function server(options?: Parameters<typeof startTestMcpServer>[0]) {
  const s = await startTestMcpServer(options)
  servers.push(s)
  return s
}

async function workspace(): Promise<string> {
  return (await t.app.inject({ method: "GET", url: "/api/v1/me" })).json().workspaces[0].id
}

function connectionsUrl(ws: string, rest = "") {
  return `/api/v1/workspaces/${ws}/mcp-connections${rest}`
}

async function connect(ws: string, body: Record<string, unknown>) {
  return t.app.inject({
    method: "POST",
    url: connectionsUrl(ws),
    payload: { name: "CRM", ...body },
  })
}

const CONFIG = {
  model: "anthropic/claude-sonnet-5-5",
  language: "en",
  effort: "medium",
  systemPrompt: "You qualify inbound sales leads.",
}

describe("MCP connections", () => {
  it("discovers the tools of a server without auth", async () => {
    const crm = await server()
    const res = await connect(await workspace(), { url: crm.url })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      name: "CRM",
      authType: "none",
      hasCredential: false,
      status: "ok",
      lastError: null,
      usedBy: [],
    })
    const tools = res.json().tools
    expect(tools.map((x: { name: string }) => x.name)).toEqual(["create_lead", "search_crm"])
    expect(tools[0].inputSchema.properties.query.type).toBe("string")
  })

  it("stores a bearer token encrypted, vaults it, and never returns it", async () => {
    const crm = await server({ token: "s3cret-token" })
    const res = await connect(await workspace(), {
      url: crm.url,
      authType: "bearer",
      bearerToken: "s3cret-token",
    })
    expect(res.json()).toMatchObject({ status: "ok", hasCredential: true })
    expect(res.body).not.toContain("s3cret-token")

    const [row] = await t.db
      .select()
      .from(mcpConnections)
      .where(eq(mcpConnections.id, res.json().id))
    expect(row?.credentialEncrypted).toMatch(/^v1:/)
    expect(row?.credentialEncrypted).not.toContain("s3cret-token")

    const [vault] = [...t.runtime.vaults.values()]
    expect([...(vault?.values() ?? [])]).toEqual([
      { url: crm.url, token: "s3cret-token", label: "Clasp: CRM" },
    ])
  })

  it("saves a connection whose discovery fails, and answers 502 on rediscover", async () => {
    const crm = await server({ token: "right" })
    const ws = await workspace()
    const res = await connect(ws, { url: crm.url, authType: "bearer", bearerToken: "wrong" })
    expect(res.statusCode).toBe(201)
    expect(res.json().status).toBe("error")
    expect(res.json().lastError).toBeTruthy()

    const again = await t.app.inject({
      method: "POST",
      url: connectionsUrl(ws, `/${res.json().id}/discover`),
    })
    expect(again.statusCode).toBe(502)
    expect(again.json().detail).toBeTruthy()
  })

  it("validates input and rejects a second connection to the same URL", async () => {
    const crm = await server()
    const ws = await workspace()
    const noToken = await connect(ws, { url: crm.url, authType: "bearer" })
    expect(noToken.statusCode).toBe(422)
    expect((await connect(ws, { url: "not a url" })).statusCode).toBe(422)

    expect((await connect(ws, { url: crm.url })).statusCode).toBe(201)
    const dup = await connect(ws, { url: crm.url, name: "Again" })
    expect(dup.statusCode).toBe(409)
  })

  it("refuses private addresses when they are not allowed", async () => {
    await expect(
      discoverTools("http://127.0.0.1:1/mcp", { allowPrivateHosts: false }),
    ).rejects.toThrow(/private address/)
  })
})

describe("agent actions", () => {
  async function agentWithActions(ws: string, connectionId: string, actions: object[]) {
    return t.app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${ws}/agents`,
      payload: {
        name: "Lead qualifier",
        config: { ...CONFIG, actions: actions.map((a) => ({ connectionId, ...a })) },
      },
    })
  }

  it("hosts an agent with its MCP actions and per-tool permissions", async () => {
    const crm = await server()
    const ws = await workspace()
    const conn = (await connect(ws, { url: crm.url })).json()
    const res = await agentWithActions(ws, conn.id, [
      { toolName: "create_lead", permission: "ask", usageNote: "Only for qualified leads" },
      { toolName: "search_crm", permission: "auto" },
    ])
    expect(res.statusCode).toBe(201)
    expect(res.json().currentVersion.actions).toEqual([
      expect.objectContaining({ toolName: "create_lead", connectionName: "CRM", stale: false }),
      expect.objectContaining({ toolName: "search_crm", permission: "auto", usageNote: "" }),
    ])

    const hosted = [...t.runtime.agents.values()][0]?.versions.at(-1)
    expect(hosted?.spec.mcpServers).toEqual([
      {
        name: `clasp-${conn.id}`,
        url: crm.url,
        tools: [
          { name: "create_lead", permission: "ask" },
          { name: "search_crm", permission: "auto" },
        ],
      },
    ])
    expect(hosted?.system).toContain("- create_lead (CRM): Only for qualified leads")

    const list = (
      await t.app.inject({ method: "GET", url: `/api/v1/workspaces/${ws}/agents` })
    ).json()
    expect(list.agents[0].actionCount).toBe(2)
  })

  it("rejects actions for tools the connection does not offer", async () => {
    const crm = await server()
    const ws = await workspace()
    const conn = (await connect(ws, { url: crm.url })).json()
    const res = await agentWithActions(ws, conn.id, [{ toolName: "delete_everything" }])
    expect(res.statusCode).toBe(422)
    expect(res.json().detail).toContain("delete_everything")
  })

  it("blocks deleting a connection in use, then allows it once the action is removed", async () => {
    const crm = await server({ token: "tok" })
    const ws = await workspace()
    const conn = (
      await connect(ws, { url: crm.url, authType: "bearer", bearerToken: "tok" })
    ).json()
    const agent = (await agentWithActions(ws, conn.id, [{ toolName: "search_crm" }])).json()

    const listed = (await t.app.inject({ method: "GET", url: connectionsUrl(ws) })).json()
    expect(listed.connections[0].usedBy).toEqual([{ id: agent.id, name: "Lead qualifier" }])

    const blocked = await t.app.inject({ method: "DELETE", url: connectionsUrl(ws, `/${conn.id}`) })
    expect(blocked.statusCode).toBe(409)
    expect(blocked.json().detail).toContain("Lead qualifier")

    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${ws}/agents/${agent.id}`,
      payload: { config: { ...CONFIG, actions: [] } },
    })
    const deleted = await t.app.inject({ method: "DELETE", url: connectionsUrl(ws, `/${conn.id}`) })
    expect(deleted.statusCode).toBe(204)
    const [vault] = [...t.runtime.vaults.values()]
    expect(vault?.size).toBe(0)
  })

  it("marks an action stale and stops hosting it when the server drops the tool", async () => {
    const crm = await server()
    const ws = await workspace()
    const conn = (await connect(ws, { url: crm.url })).json()
    const agent = (
      await agentWithActions(ws, conn.id, [{ toolName: "create_lead" }, { toolName: "search_crm" }])
    ).json()

    crm.tools = ["search_crm"]
    await t.app.inject({ method: "POST", url: connectionsUrl(ws, `/${conn.id}/discover`) })

    const fresh = (
      await t.app.inject({ method: "GET", url: `/api/v1/workspaces/${ws}/agents/${agent.id}` })
    ).json()
    expect(
      fresh.currentVersion.actions.map((a: { toolName: string; stale: boolean }) => [
        a.toolName,
        a.stale,
      ]),
    ).toEqual([
      ["create_lead", true],
      ["search_crm", false],
    ])
    const hosted = [...t.runtime.agents.values()][0]?.versions.at(-1)
    expect(hosted?.spec.mcpServers[0]?.tools.map((x) => x.name)).toEqual(["search_crm"])

    // Saving with the stale action still in place is allowed; only new actions must exist.
    const saved = await t.app.inject({
      method: "PATCH",
      url: `/api/v1/workspaces/${ws}/agents/${agent.id}`,
      payload: { name: "Renamed" },
    })
    expect(saved.statusCode).toBe(200)
  })

  it("re-hosts agents on the new URL when a connection moves", async () => {
    const crm = await server()
    const moved = await server()
    const ws = await workspace()
    const conn = (await connect(ws, { url: crm.url })).json()
    await agentWithActions(ws, conn.id, [{ toolName: "search_crm" }])

    const res = await t.app.inject({
      method: "PATCH",
      url: connectionsUrl(ws, `/${conn.id}`),
      payload: { url: moved.url },
    })
    expect(res.json()).toMatchObject({ url: moved.url, status: "ok" })
    const hosted = [...t.runtime.agents.values()][0]?.versions.at(-1)
    expect(hosted?.spec.mcpServers[0]?.url).toBe(moved.url)
  })
})
