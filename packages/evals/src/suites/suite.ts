import type Anthropic from "@anthropic-ai/sdk"
import type { CostMeter } from "../cost.js"
import type { Score } from "../scorers/score.js"
import type { HostedAgents } from "../subjects/hosted-agent.js"

/** What every suite receives: the model client, the hosted-agent runner, and the budget. */
export interface SuiteContext {
  client: Anthropic
  hosted: HostedAgents
  meter: CostMeter
  model: string
}

export interface SuiteCase<Input> {
  input: Input
  metadata: { id: string; tags: string[] }
}

/**
 * One eval: one flow, its dataset, how the app runs on a case, and how the result is graded.
 * Guardrail scorers (binary safety properties) tolerate no regression at all.
 */
export interface Suite<Input, Output> {
  name: string
  description: string
  cases: SuiteCase<Input>[]
  guardrails: string[]
  task(ctx: SuiteContext, input: Input): Promise<Output>
  score(ctx: SuiteContext, input: Input, output: Output): Promise<Score[]>
}
