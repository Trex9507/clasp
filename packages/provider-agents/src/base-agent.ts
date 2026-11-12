import Anthropic from "@anthropic-ai/sdk"
import { callMcp } from "./client.js"

export type JobType = "listing_copy" | "translation" | "competitor_research"

// Providers do bounded, high-volume work, so they default to the current Haiku.
export const DEFAULT_PROVIDER_MODEL = "claude-haiku-5-5"

export interface AgentConfig {
  agentId: string
  jobType: JobType
  systemPrompt: string
  /** Overrides CLASP_PROVIDER_MODEL and the default. */
  model?: string
  /** Injectable for tests; created lazily otherwise. */
  client?: Anthropic
}

interface DeliveryResult {
  verification_passed: boolean
  needs_revision: boolean
}

export class BaseAgent {
  private client: Anthropic | undefined

  constructor(protected config: AgentConfig) {
    this.client = config.client
  }

  get model(): string {
    return this.config.model ?? process.env.CLASP_PROVIDER_MODEL ?? DEFAULT_PROVIDER_MODEL
  }

  private getClient(): Anthropic {
    this.client ??= new Anthropic()
    return this.client
  }

  /** Takes an open job, completes it, and uses the free revision if verification fails once. */
  async run(jobId: string, spec: Record<string, unknown>): Promise<void> {
    const tag = `[${this.config.jobType}]`
    console.log(`${tag} accepting job ${jobId}`)
    await callMcp("clasp_accept", { job_id: jobId, provider_id: this.config.agentId })

    const delivery = await this.generate(spec)
    const result = (await callMcp("clasp_deliver", {
      job_id: jobId,
      provider_id: this.config.agentId,
      delivery_json: delivery,
    })) as DeliveryResult

    if (result.verification_passed) {
      console.log(`${tag} job ${jobId} completed and paid`)
      return
    }
    if (result.needs_revision) {
      console.log(`${tag} free revision for job ${jobId}, retrying`)
      const revised = await this.generate(spec, true)
      await callMcp("clasp_deliver", {
        job_id: jobId,
        provider_id: this.config.agentId,
        delivery_json: revised,
      })
    }
  }

  protected async generate(
    spec: Record<string, unknown>,
    isRevision = false,
  ): Promise<Record<string, unknown>> {
    const prompt = isRevision
      ? `Redo the following job and meet EVERY criterion. This is the mandatory revision.\nSpec: ${JSON.stringify(spec)}`
      : `Do the job and follow these criteria exactly:\n${JSON.stringify(spec, null, 2)}`

    const message = await this.getClient().messages.create({
      model: this.model,
      max_tokens: 16000,
      system: this.config.systemPrompt,
      messages: [{ role: "user", content: prompt }],
    })

    // Thinking blocks can precede the answer, so look for the first text block.
    const text = message.content.find((block) => block.type === "text")?.text ?? ""
    return parseJsonReply(text)
  }
}

/** Extracts the JSON object from a model reply; falls back to the raw text. */
export function parseJsonReply(text: string): Record<string, unknown> {
  const match = text.match(/```json\n?([\s\S]*?)\n?```/) ?? text.match(/(\{[\s\S]*\})/)
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]) as Record<string, unknown>
    } catch {
      // Not valid JSON: fall through to the raw text.
    }
  }
  return { text }
}
