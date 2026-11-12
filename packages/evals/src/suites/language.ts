import { LANGUAGE_CASES, SALES_ASSISTANT_PROMPT, type LanguageCase } from "../datasets/language.js"
import { respondsInLanguage } from "../scorers/code.js"
import type { HostedAgentOutput } from "../subjects/hosted-agent.js"
import type { Suite } from "./suite.js"

/** End to end through the hosted runtime: the exact prompt and harness production uses. */
export const languageSuite: Suite<LanguageCase, HostedAgentOutput> = {
  name: "response-language",
  description:
    "Agents answer in their configured language unless the user explicitly asks otherwise.",
  cases: LANGUAGE_CASES.map((c) => ({ input: c, metadata: { id: c.id, tags: c.tags } })),
  guardrails: [],
  task: (ctx, c) =>
    ctx.hosted.run(
      ctx.meter,
      { systemPrompt: SALES_ASSISTANT_PROMPT, language: c.agentLanguage, effort: "low" },
      c.message,
    ),
  score: async (_ctx, c, output) => [
    respondsInLanguage(output.reply, c.expectedLanguage),
    {
      name: "completed",
      score: output.status === "idle" ? 1 : 0,
      metadata: { status: output.status },
    },
  ],
}
