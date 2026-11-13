import { LANGUAGES } from "@clasp/shared"
import type { ActionNote } from "./types.js"

function languageName(code: string): string {
  const entry = LANGUAGES.find((l) => l.code === code)
  // Labels read "Italiano (Italian)"; the English name in brackets is the clearest instruction.
  return entry?.label.match(/\(([^)]+)\)$/)?.[1] ?? entry?.label ?? code
}

/**
 * The system prompt the runtime receives: the user's prompt, then a short platform section. The
 * user's text comes first and unchanged, so what they wrote is what the agent reads.
 */
export function buildSystemPrompt(
  userPrompt: string,
  language: string,
  actions: ActionNote[] = [],
): string {
  const lines = [userPrompt.trim(), "", "<platform>"]
  const noted = actions.filter((a) => a.usageNote.trim())
  if (noted.length > 0) {
    lines.push("Guidance on when to use your actions:")
    for (const a of noted)
      lines.push(`- ${a.toolName} (${a.connectionName}): ${a.usageNote.trim()}`)
    lines.push("")
  }
  lines.push(
    `Always respond in ${languageName(language)}, whatever language the user writes in, unless they explicitly ask for a different one.`,
    "</platform>",
  )
  return lines.join("\n")
}
