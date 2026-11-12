import { describe, it, expect, vi, afterEach } from "vitest"
import type Anthropic from "@anthropic-ai/sdk"
import { CopyAgent } from "./copy-agent.js"
import { TranslationAgent } from "./translation-agent.js"
import { ResearchAgent } from "./research-agent.js"
import { DEFAULT_PROVIDER_MODEL, parseJsonReply } from "./base-agent.js"

vi.mock("./client.js", () => ({
  callMcp: vi.fn().mockResolvedValue({ verification_passed: true, needs_revision: false }),
}))

function fakeClient(reply: string) {
  const create = vi.fn().mockResolvedValue({
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: reply },
    ],
  })
  return { client: { messages: { create } } as unknown as Anthropic, create }
}

afterEach(() => {
  delete process.env.CLASP_PROVIDER_MODEL
})

describe("provider agents", () => {
  it("default to the current Haiku model", () => {
    expect(new CopyAgent("agent-1").model).toBe(DEFAULT_PROVIDER_MODEL)
  })

  it("take the model from the environment, then from the constructor", () => {
    process.env.CLASP_PROVIDER_MODEL = "claude-sonnet-5-5"
    expect(new ResearchAgent("agent-2").model).toBe("claude-sonnet-5-5")
    expect(new ResearchAgent("agent-2", { model: "claude-opus-5-5" }).model).toBe("claude-opus-5-5")
  })

  it("read the first text block, skipping thinking blocks", async () => {
    const { client, create } = fakeClient('```json\n{"items":[{"title":"T","text":"Body"}]}\n```')
    const agent = new CopyAgent("agent-3", { client })
    await agent.run("job-1", { type: "listing_copy" })
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]?.[0]).toMatchObject({ model: DEFAULT_PROVIDER_MODEL })
  })

  it("add an explicit instruction when translating a source text", async () => {
    const { client, create } = fakeClient('{"text":"Hello"}')
    const agent = new TranslationAgent("agent-4", { client })
    await agent.run("job-2", { language: "en", source_text: "Ciao" })
    const prompt = create.mock.calls[0]?.[0].messages[0].content as string
    expect(prompt).toContain("Translate the source text into en")
  })
})

describe("parseJsonReply", () => {
  it("parses a fenced JSON block", () => {
    expect(parseJsonReply('Here:\n```json\n{"text":"a"}\n```')).toEqual({ text: "a" })
  })

  it("falls back to the raw text", () => {
    expect(parseJsonReply("no json here")).toEqual({ text: "no json here" })
  })
})
