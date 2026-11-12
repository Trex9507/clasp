import { describe, expect, it, vi } from "vitest"
import type Anthropic from "@anthropic-ai/sdk"
import type { RunEvent } from "@clasp/shared"
import { toRunEvent, toRunUsage } from "./managed-agents-events.js"
import { FakeRuntime } from "./fake-runtime.js"
import { ManagedAgentsRuntime } from "./managed-agents-runtime.js"
import type { AgentVersionSpec } from "./types.js"

const AT = "2026-11-13T10:00:00.000Z"

describe("toRunEvent", () => {
  it("maps messages, MCP tool calls and results", () => {
    expect(
      toRunEvent({
        id: "e1",
        type: "agent.message",
        processed_at: AT,
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: "there" },
        ],
      }),
    ).toEqual({ id: "e1", at: AT, kind: "agent_message", text: "Hello\nthere" })
    expect(
      toRunEvent({
        id: "e2",
        type: "agent.mcp_tool_use",
        processed_at: AT,
        name: "search_crm",
        mcp_server_name: "clasp-c1",
        input: { q: "acme" },
        evaluated_permission: "ask",
      }),
    ).toEqual({
      id: "e2",
      at: AT,
      kind: "tool_call",
      toolName: "search_crm",
      connectionName: "clasp-c1",
      input: { q: "acme" },
      permission: "ask",
    })
    expect(
      toRunEvent({
        id: "e3",
        type: "agent.mcp_tool_result",
        processed_at: AT,
        mcp_tool_use_id: "e2",
        content: [{ type: "text", text: "found" }],
        is_error: false,
      }),
    ).toMatchObject({ kind: "tool_result", toolCallId: "e2", output: "found", isError: false })
  })

  it("maps idle stop reasons to run statuses", () => {
    const idle = (type: string, event_ids?: string[]) =>
      toRunEvent({
        id: "s",
        type: "session.status_idle",
        processed_at: AT,
        stop_reason: { type, event_ids },
      })
    expect(idle("end_turn")).toMatchObject({ status: "idle", pendingToolCallIds: [] })
    expect(idle("requires_action", ["e2"])).toMatchObject({
      status: "awaiting_approval",
      pendingToolCallIds: ["e2"],
    })
    expect(idle("budget_reached")).toMatchObject({ status: "budget_reached" })
    expect(toRunEvent({ id: "t", type: "session.status_terminated" })).toMatchObject({
      status: "ended",
    })
  })

  it("drops events the playground does not show", () => {
    expect(toRunEvent({ id: "x", type: "span.model_request_start" })).toBeUndefined()
    expect(toRunEvent({ type: "event_delta" })).toBeUndefined()
  })

  it("reads list cost in cents and sums cache creation", () => {
    expect(
      toRunUsage({
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 2,
        cache_creation: { ephemeral_5m_input_tokens: 3, ephemeral_1h_input_tokens: 4 },
        list_cost: { amount: "123", currency: "USD" },
      }),
    ).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 2,
      cacheCreationTokens: 7,
      costCents: 123,
    })
  })
})

describe("ManagedAgentsRuntime sessions", () => {
  it("pins the agent version, attaches vaults and sets the budget in cents", async () => {
    const sessions = {
      create: vi.fn().mockResolvedValue({ id: "sesn_1" }),
      events: { send: vi.fn().mockResolvedValue({}) },
    }
    const client = { beta: { sessions } } as unknown as Anthropic
    const runtime = new ManagedAgentsRuntime({ client })
    const { sessionId } = await runtime.startSession({
      agent: { provider: "anthropic-managed-agents", agentId: "agent_1", version: 4 },
      environmentId: "env_1",
      vaultIds: ["vlt_1"],
      budgetCents: 100,
      title: "Playground",
      metadata: { clasp_run_id: "run-1" },
    })
    expect(sessionId).toBe("sesn_1")
    expect(sessions.create).toHaveBeenCalledWith({
      agent: { type: "agent", id: "agent_1", version: 4 },
      environment_id: "env_1",
      vault_ids: ["vlt_1"],
      budget: { type: "limit", max_list_cost: { amount: "100", currency: "USD" } },
      title: "Playground",
      metadata: { clasp_run_id: "run-1" },
    })

    await runtime.decideTool("sesn_1", "sevt_9", "deny", "Not this customer")
    expect(sessions.events.send).toHaveBeenCalledWith("sesn_1", {
      events: [
        {
          type: "user.tool_confirmation",
          tool_use_id: "sevt_9",
          result: "deny",
          deny_message: "Not this customer",
        },
      ],
    })
  })
})

describe("FakeRuntime sessions", () => {
  const SPEC: AgentVersionSpec = {
    claspAgentId: "a",
    claspVersionId: "v",
    workspaceId: "w",
    name: "Agent",
    description: "",
    systemPrompt: "Hi",
    language: "en",
    providerModelId: "claude-sonnet-5-5",
    effort: "medium",
    mcpServers: [
      {
        name: "clasp-c1",
        url: "http://crm",
        tools: [
          { name: "create_lead", permission: "ask" },
          { name: "search_crm", permission: "auto" },
        ],
      },
    ],
    actions: [],
  }

  async function started() {
    const runtime = new FakeRuntime()
    const agent = await runtime.upsertAgent(SPEC)
    const { sessionId } = await runtime.startSession({
      agent,
      environmentId: await runtime.ensureEnvironment(),
      vaultIds: [],
      budgetCents: 100,
      title: "t",
      metadata: {},
    })
    return { runtime, sessionId }
  }

  async function until(
    runtime: FakeRuntime,
    sessionId: string,
    status: string,
  ): Promise<RunEvent[]> {
    for (let i = 0; i < 50; i++) {
      const events = await runtime.listEvents(sessionId)
      if (events.some((e) => e.kind === "status" && e.status === status && e !== events[0])) {
        const last = events.at(-1)
        if (last?.kind === "status" && last.status === status) return events
      }
      await new Promise((r) => setImmediate(r))
    }
    throw new Error(`never reached ${status}`)
  }

  it("echoes a message and reports usage", async () => {
    const { runtime, sessionId } = await started()
    await runtime.sendMessage(sessionId, "Hello")
    const events = await until(runtime, sessionId, "idle")
    expect(events.map((e) => e.kind)).toEqual([
      "user_message",
      "status",
      "agent_message",
      "usage",
      "status",
    ])
    expect((await runtime.getUsage(sessionId)).outputTokens).toBeGreaterThan(0)
  })

  it("pauses an ask action until it is approved", async () => {
    const { runtime, sessionId } = await started()
    await runtime.sendMessage(sessionId, "please create_lead for Acme")
    const waiting = await until(runtime, sessionId, "awaiting_approval")
    const call = waiting.find((e) => e.kind === "tool_call")
    expect(call).toMatchObject({ toolName: "create_lead", permission: "ask" })
    await expect(runtime.sendMessage(sessionId, "hello?")).rejects.toThrow(/waiting/)

    await runtime.decideTool(sessionId, call!.id, "allow")
    const done = await until(runtime, sessionId, "idle")
    expect(done.find((e) => e.kind === "tool_result")).toMatchObject({
      toolCallId: call!.id,
      isError: false,
    })
  })

  it("runs an auto action without asking and streams live events", async () => {
    const { runtime, sessionId } = await started()
    const controller = new AbortController()
    const seen: string[] = []
    const reading = (async () => {
      for await (const event of runtime.streamEvents(sessionId, controller.signal)) {
        seen.push(event.kind)
        if (event.kind === "status" && event.status === "idle") controller.abort()
      }
    })()
    await runtime.sendMessage(sessionId, "search_crm acme")
    await reading
    expect(seen).toEqual([
      "user_message",
      "status",
      "tool_call",
      "tool_result",
      "agent_message",
      "usage",
      "status",
    ])
  })
})
