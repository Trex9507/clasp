import { describe, expect, it, vi } from "vitest"
import Anthropic from "@anthropic-ai/sdk"
import { buildSystemPrompt } from "./system-prompt.js"
import { FakeRuntime } from "./fake-runtime.js"
import { ManagedAgentsRuntime } from "./managed-agents-runtime.js"
import { RuntimeError, type AgentVersionSpec } from "./types.js"

const SPEC: AgentVersionSpec = {
  claspAgentId: "agent-1",
  claspVersionId: "version-1",
  workspaceId: "ws-1",
  name: "Lead qualifier",
  description: "Qualifies inbound leads",
  systemPrompt: "You qualify inbound sales leads.",
  language: "it",
  providerModelId: "claude-sonnet-5-5",
  effort: "medium",
}

describe("buildSystemPrompt", () => {
  it("keeps the user's prompt first and adds the language directive", () => {
    const prompt = buildSystemPrompt("  You qualify leads.  ", "it")
    expect(prompt.startsWith("You qualify leads.")).toBe(true)
    expect(prompt).toContain("Always respond in Italian")
  })

  it("falls back to the code for an unknown language", () => {
    expect(buildSystemPrompt("Hi", "xx")).toContain("Always respond in xx")
  })
})

describe("FakeRuntime", () => {
  it("creates at version 1, bumps on change, keeps the version when nothing changed", async () => {
    const runtime = new FakeRuntime()
    const ref = await runtime.upsertAgent(SPEC)
    expect(ref.version).toBe(1)
    expect((await runtime.upsertAgent(SPEC, ref)).version).toBe(1)
    expect((await runtime.upsertAgent({ ...SPEC, effort: "high" }, ref)).version).toBe(2)
  })

  it("rejects updates to an archived agent", async () => {
    const runtime = new FakeRuntime()
    const ref = await runtime.upsertAgent(SPEC)
    await runtime.archiveAgent(ref)
    await expect(runtime.upsertAgent(SPEC, ref)).rejects.toBeInstanceOf(RuntimeError)
  })

  it("can be told to fail once", async () => {
    const runtime = new FakeRuntime()
    runtime.failNext = "boom"
    await expect(runtime.upsertAgent(SPEC)).rejects.toThrow("boom")
    await expect(runtime.upsertAgent(SPEC)).resolves.toMatchObject({ version: 1 })
  })
})

describe("ManagedAgentsRuntime", () => {
  function stubClient() {
    const agents = {
      create: vi.fn().mockResolvedValue({ id: "agent_abc", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "agent_abc", version: 2 }),
      archive: vi.fn().mockResolvedValue({ id: "agent_abc" }),
    }
    return { client: { beta: { agents } } as unknown as Anthropic, agents }
  }

  it("creates an agent with model, effort, the built prompt and Clasp metadata", async () => {
    const { client, agents } = stubClient()
    const ref = await new ManagedAgentsRuntime({ client }).upsertAgent(SPEC)
    expect(ref).toEqual({ provider: "anthropic-managed-agents", agentId: "agent_abc", version: 1 })
    expect(agents.create).toHaveBeenCalledWith({
      name: "Lead qualifier",
      description: "Qualifies inbound leads",
      model: { id: "claude-sonnet-5-5", effort: "medium" },
      system: buildSystemPrompt(SPEC.systemPrompt, "it"),
      metadata: {
        clasp_agent_id: "agent-1",
        clasp_version_id: "version-1",
        clasp_workspace_id: "ws-1",
      },
    })
  })

  it("updates in place when the agent already exists", async () => {
    const { client, agents } = stubClient()
    const ref = await new ManagedAgentsRuntime({ client }).upsertAgent(SPEC, {
      provider: "anthropic-managed-agents",
      agentId: "agent_abc",
      version: 1,
    })
    expect(agents.create).not.toHaveBeenCalled()
    expect(agents.update).toHaveBeenCalledWith(
      "agent_abc",
      expect.objectContaining({ name: "Lead qualifier" }),
    )
    expect(ref.version).toBe(2)
  })

  it("wraps SDK failures in RuntimeError", async () => {
    const { client, agents } = stubClient()
    agents.create.mockRejectedValueOnce(new Error("network down"))
    await expect(new ManagedAgentsRuntime({ client }).upsertAgent(SPEC)).rejects.toThrow(
      "Managed Agents create failed: network down",
    )
  })
})

// Opt-in contract test against the real API. It creates, updates and then archives one agent in
// the workspace the key belongs to, so it never runs by accident.
const live = process.env.ANTHROPIC_API_KEY && process.env.CLASP_LIVE_RUNTIME_TESTS === "1"
describe.runIf(live)("ManagedAgentsRuntime (live)", () => {
  it("creates, updates and archives an agent", { timeout: 60_000 }, async () => {
    const runtime = new ManagedAgentsRuntime()
    const ref = await runtime.upsertAgent({ ...SPEC, name: "Clasp contract test (safe to ignore)" })
    try {
      expect(ref.version).toBe(1)
      const updated = await runtime.upsertAgent(
        { ...SPEC, name: "Clasp contract test (safe to ignore)", effort: "low" },
        ref,
      )
      expect(updated.version).toBe(2)
    } finally {
      await runtime.archiveAgent(ref)
    }
  })
})
