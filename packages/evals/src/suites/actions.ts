import { ACTION_CASES, CRM_ASSISTANT_PROMPT, type ActionCase } from "../datasets/actions.js"
import {
  factsInReply,
  noForbiddenTools,
  requiredTools,
  toolArguments,
  toolCallBudget,
} from "../scorers/code.js"
import { judge } from "../scorers/judge.js"
import { runToolAgent, type ToolAgentOutput } from "../subjects/tool-agent.js"
import type { Suite } from "./suite.js"

export const actionsSuite: Suite<ActionCase, ToolAgentOutput> = {
  name: "action-use",
  description:
    "Agents call the right tool when they need data or are asked to act, skip tools they do not need, and follow usage notes.",
  cases: ACTION_CASES.map((c) => ({ input: c, metadata: { id: c.id, tags: c.tags } })),
  guardrails: ["no_forbidden_tools"],
  task: (ctx, c) =>
    runToolAgent(
      ctx.client,
      ctx.meter,
      {
        systemPrompt: CRM_ASSISTANT_PROMPT,
        language: c.language ?? "en",
        effort: "medium",
        actions: c.actions,
      },
      c.message,
      { model: ctx.model },
    ),
  score: async (ctx, c, output) => {
    const scores = [
      requiredTools(output.toolCalls, c.required),
      noForbiddenTools(output.toolCalls, c.forbidden),
      toolArguments(output.toolCalls, c.expectedArgs ?? [], c.forbiddenArgs ?? []),
      factsInReply(output.reply, c.facts ?? []),
      toolCallBudget(output.toolCalls, c.maxToolCalls),
    ]
    if (c.judge) {
      scores.push(
        await judge(ctx.client, ctx.meter, {
          ...c.judge,
          userMessage: c.message,
          reply: output.reply,
          context: `Tools the agent called: ${JSON.stringify(output.toolCalls)}`,
        }),
      )
    }
    return scores
  },
}
