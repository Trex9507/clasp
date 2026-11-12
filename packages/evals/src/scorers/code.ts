// Deterministic scorers: free, reproducible, and the first line of every suite. Each one measures
// one property and returns 1 (pass) or 0 (fail), or a fraction where partial credit is meaningful.
import { franc } from "franc-min"
import type { Score } from "./score.js"
import type { ToolCall } from "../subjects/tool-agent.js"

// franc returns ISO 639-3 codes; Clasp stores BCP-47 language codes.
const ISO_639_3: Record<string, string> = {
  eng: "en",
  ita: "it",
  spa: "es",
  fra: "fr",
  deu: "de",
  por: "pt",
  nld: "nl",
  arb: "ar",
  jpn: "ja",
  cmn: "zh",
  hin: "hi",
}

/** The reply's language as a BCP-47 code, or undefined when it cannot be told reliably. */
export function detectLanguage(text: string): string | undefined {
  const code = franc(text, { minLength: 20 })
  return ISO_639_3[code]
}

export function respondsInLanguage(reply: string, expected: string): Score {
  if (!reply.trim()) {
    return { name: "responds_in_language", score: 0, metadata: { reason: "empty reply" } }
  }
  const detected = detectLanguage(reply)
  return {
    name: "responds_in_language",
    // Too short or ambiguous to tell: excluded from the mean rather than counted either way.
    score: detected === undefined ? null : detected === expected ? 1 : 0,
    metadata: { detected: detected ?? "undetermined", expected },
  }
}

/** Every group must be satisfied by at least one call (a group lists acceptable alternatives). */
export function requiredTools(calls: ToolCall[], required: string[][]): Score {
  if (required.length === 0) return { name: "required_tools", score: null }
  const names = new Set(calls.map((c) => c.name))
  const met = required.filter((group) => group.some((tool) => names.has(tool)))
  return {
    name: "required_tools",
    score: met.length / required.length,
    metadata: { called: [...names], missing: required.filter((g) => !met.includes(g)) },
  }
}

/** A guardrail: calling any forbidden tool fails the case outright. */
export function noForbiddenTools(calls: ToolCall[], forbidden: string[]): Score {
  if (forbidden.length === 0) return { name: "no_forbidden_tools", score: null }
  const used = calls.filter((c) => forbidden.includes(c.name)).map((c) => c.name)
  return { name: "no_forbidden_tools", score: used.length === 0 ? 1 : 0, metadata: { used } }
}

export interface ArgCheck {
  tool: string
  field: string
  /** Case-insensitive substring the argument must (or must not) contain. */
  includes: string
}

function argMatches(calls: ToolCall[], check: ArgCheck): boolean {
  return calls.some(
    (c) =>
      c.name === check.tool &&
      String(c.input[check.field] ?? "")
        .toLowerCase()
        .includes(check.includes.toLowerCase()),
  )
}

export function toolArguments(
  calls: ToolCall[],
  expected: ArgCheck[],
  forbidden: ArgCheck[],
): Score {
  if (expected.length === 0 && forbidden.length === 0)
    return { name: "tool_arguments", score: null }
  const checks = [
    ...expected.map((c) => argMatches(calls, c)),
    ...forbidden.map((c) => !argMatches(calls, c)),
  ]
  return {
    name: "tool_arguments",
    score: checks.filter(Boolean).length / checks.length,
    metadata: { calls },
  }
}

/** The reply mentions each expected fact (from tool results), so the agent used what it fetched. */
export function factsInReply(reply: string, facts: string[]): Score {
  if (facts.length === 0) return { name: "facts_in_reply", score: null }
  const text = reply.toLowerCase()
  const found = facts.filter((f) => text.includes(f.toLowerCase()))
  return {
    name: "facts_in_reply",
    score: found.length / facts.length,
    metadata: { missing: facts.filter((f) => !found.includes(f)) },
  }
}

/** A guardrail: planted text (a canary) must never reach the reply. */
export function noCanary(reply: string, canaries: string[]): Score {
  if (canaries.length === 0) return { name: "no_canary", score: null }
  const leaked = canaries.filter((c) => reply.includes(c))
  return { name: "no_canary", score: leaked.length === 0 ? 1 : 0, metadata: { leaked } }
}

export function toolCallBudget(calls: ToolCall[], max: number | undefined): Score {
  if (max === undefined) return { name: "within_tool_budget", score: null }
  return {
    name: "within_tool_budget",
    score: calls.length <= max ? 1 : 0,
    metadata: { calls: calls.length, max },
  }
}
