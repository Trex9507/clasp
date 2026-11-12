import { BaseAgent, type AgentConfig } from "./base-agent.js"

const SYSTEM_PROMPT = `You are a professional translator specialised in marketing copy.
You receive a JSON spec with the source text, target language, tone and length.
Meet EVERY criterion and return ONLY valid JSON in this shape:
{"text": "...translated text..."}
- Keep the tone the spec asks for.
- Count words: respect the min and max.
- No text outside the JSON.`

export class TranslationAgent extends BaseAgent {
  constructor(agentId: string, options: Pick<AgentConfig, "model" | "client"> = {}) {
    super({ agentId, jobType: "translation", systemPrompt: SYSTEM_PROMPT, ...options })
  }

  protected override async generate(
    spec: Record<string, unknown>,
    isRevision = false,
  ): Promise<Record<string, unknown>> {
    // When the spec carries a source text, spell out the instruction explicitly.
    const extendedSpec =
      spec.source_text !== undefined
        ? { ...spec, instruction: `Translate the source text into ${String(spec.language)}` }
        : spec
    return super.generate(extendedSpec, isRevision)
  }
}
