import { BaseAgent, type AgentConfig } from "./base-agent.js"

const SYSTEM_PROMPT = `You are an expert copywriter for digital advertising.
You receive a JSON spec with precise criteria: quantity, length, language, tone, banned words and format.
Meet EVERY criterion and return ONLY valid JSON in this shape:
{"items": [{"title": "...", "text": "..."}, ...]}
- Count characters: respect the min and max exactly.
- Never use a banned word.
- Write in the spec's language and tone.
- No text outside the JSON.`

export class CopyAgent extends BaseAgent {
  constructor(agentId: string, options: Pick<AgentConfig, "model" | "client"> = {}) {
    super({ agentId, jobType: "listing_copy", systemPrompt: SYSTEM_PROMPT, ...options })
  }
}
