import { describe, it, expect, vi, beforeEach } from "vitest";
import { CopyAgent } from "./copy-agent.js";
import { TranslationAgent } from "./translation-agent.js";
import { ResearchAgent } from "./research-agent.js";

// Mock delle dipendenze esterne
vi.mock("./client.js", () => ({
  callMcp: vi.fn().mockResolvedValue({ verification_passed: true, needs_revision: false }),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"items":[{"titolo":"T","testo":"Testo di esempio per il test unitario che rispetta i criteri minimi."}]}' }],
      }),
    };
  },
}));

describe("CopyAgent", () => {
  it("si instanzia con un agentId", () => {
    const agent = new CopyAgent("agent-test-001");
    expect(agent).toBeDefined();
  });
});

describe("TranslationAgent", () => {
  it("si instanzia con un agentId", () => {
    const agent = new TranslationAgent("agent-test-002");
    expect(agent).toBeDefined();
  });
});

describe("ResearchAgent", () => {
  it("si instanzia con un agentId", () => {
    const agent = new ResearchAgent("agent-test-003");
    expect(agent).toBeDefined();
  });
});
