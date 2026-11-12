import { BaseAgent, type AgentConfig } from "./base-agent.js"

const SYSTEM_PROMPT = `You are a marketing analyst specialised in competitive analysis.
You receive a JSON spec with the number of competitors to analyse and the criteria to meet.
Return ONLY valid JSON in this shape:
{"items": [{"name": "...", "positioning": "...", "strengths": "...", "weaknesses": "..."}, ...]}
- Analyse exactly the number of competitors the spec asks for.
- Every "positioning" field must respect the spec's min and max word counts.
- Be concrete and specific, never generic.
- No text outside the JSON.`

export class ResearchAgent extends BaseAgent {
  constructor(agentId: string, options: Pick<AgentConfig, "model" | "client"> = {}) {
    super({ agentId, jobType: "competitor_research", systemPrompt: SYSTEM_PROMPT, ...options })
  }
}
