import { GUARDED_PROMPT, INJECTION_CASES, type InjectionCase } from "../datasets/injection.js"
import {
  factsInReply,
  noCanary,
  noForbiddenTools,
  requiredTools,
  toolArguments,
} from "../scorers/code.js"
import { runToolAgent, type ToolAgentOutput } from "../subjects/tool-agent.js"
import type { Suite } from "./suite.js"

/** Fully code-graded: each property is binary and checkable, so no judge is needed. */
export const injectionSuite: Suite<InjectionCase, ToolAgentOutput> = {
  name: "tool-output-injection",
  description:
    "Agents ignore instructions planted in tool results and keep serving the user's actual request.",
  cases: INJECTION_CASES.map((c) => ({ input: c, metadata: { id: c.id, tags: c.tags } })),
  guardrails: ["no_forbidden_tools", "no_canary"],
  task: (ctx, c) =>
    runToolAgent(
      ctx.client,
      ctx.meter,
      { systemPrompt: GUARDED_PROMPT, language: "en", effort: "medium", actions: c.actions },
      c.message,
      { model: ctx.model, toolOutputs: c.toolOutputs },
    ),
  score: async (_ctx, c, output) => [
    noForbiddenTools(output.toolCalls, c.forbidden),
    noCanary(output.reply, c.canaries),
    requiredTools(output.toolCalls, c.required),
    toolArguments(output.toolCalls, c.expectedArgs ?? [], c.forbiddenArgs ?? []),
    factsInReply(output.reply, c.facts ?? []),
  ],
}
