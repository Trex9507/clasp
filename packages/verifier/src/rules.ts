// Verification rules in plain code: no model calls, zero cost.
// Tone is the one subjective criterion; it is flagged for a separate model check.
import type { JobSpec, LengthUnit } from "./spec.js"

export interface VerificationResult {
  passed: boolean
  failures: string[]
  warnings: string[]
  /** True when the spec asks for a tone, which only a model can judge. */
  needs_ai_check: boolean
}

// Fields that carry the main body of an item, in priority order.
const MAIN_TEXT_FIELDS = ["text", "translated_text", "positioning", "description"]

function textLength(text: string, unit: LengthUnit): number {
  return unit === "characters" ? text.length : text.trim().split(/\s+/).length
}

// Phase-1 heuristic that counts common stopwords. Production should use a
// language-detection library or a model call instead.
function detectLanguage(text: string): string {
  const italian = /\b(il|la|le|lo|gli|di|che|non|un|una|per|con|del|della|dei|è)\b/gi
  const english = /\b(the|and|for|with|this|that|are|you|have|from|not)\b/gi
  const itCount = (text.match(italian) ?? []).length
  const enCount = (text.match(english) ?? []).length
  if (itCount === 0 && enCount === 0) return "unknown"
  return itCount > enCount ? "it" : "en"
}

function checkText(text: string, spec: JobSpec, label: string): string[] {
  const failures: string[] = []
  const len = textLength(text, spec.length.unit)
  if (len < spec.length.min) {
    failures.push(`${label} too short (${len} ${spec.length.unit}, min ${spec.length.min})`)
  }
  if (len > spec.length.max) {
    failures.push(`${label} too long (${len} ${spec.length.unit}, max ${spec.length.max})`)
  }
  for (const word of spec.banned_words ?? []) {
    if (text.toLowerCase().includes(word.toLowerCase())) {
      failures.push(`${label} contains banned word "${word}"`)
    }
  }
  return failures
}

export function verifyItem(item: Record<string, unknown>, spec: JobSpec, index: number): string[] {
  const prefix = `item[${index}]`
  const failures: string[] = []

  for (const field of spec.format.fields ?? []) {
    if (!(field in item)) failures.push(`${prefix}: missing field "${field}"`)
  }

  const textKey = spec.format.fields?.find((f) => MAIN_TEXT_FIELDS.includes(f)) ?? "text"
  const text = typeof item[textKey] === "string" ? (item[textKey] as string) : null
  if (text === null) return failures

  failures.push(...checkText(text, spec, `${prefix}: ${textKey}`))
  if (spec.language) {
    const detected = detectLanguage(text)
    if (detected !== "unknown" && detected !== spec.language) {
      failures.push(`${prefix}: detected language "${detected}", expected "${spec.language}"`)
    }
  }
  return failures
}

export function verify(spec: JobSpec, delivery: unknown): VerificationResult {
  const failures: string[] = []
  const warnings: string[] = []
  const needs_ai_check = (spec.tone?.length ?? 0) > 0

  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    return {
      passed: false,
      failures: ["delivery is not an object"],
      warnings,
      needs_ai_check: false,
    }
  }
  const d = delivery as Record<string, unknown>

  if (spec.format.type === "json") {
    if (!Array.isArray(d.items)) {
      return { passed: false, failures: ['missing "items" array'], warnings, needs_ai_check: false }
    }
    const items = d.items as unknown[]
    if (items.length < spec.quantity) {
      failures.push(`not enough items: ${items.length} of ${spec.quantity} required`)
    }
    items.forEach((item, i) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        failures.push(`item[${i}] is not an object`)
        return
      }
      failures.push(...verifyItem(item as Record<string, unknown>, spec, i))
    })
  } else {
    // "text" and "markdown" deliveries carry a single body in `text`.
    const text = typeof d.text === "string" ? d.text : null
    if (!text) {
      failures.push('missing "text" field')
    } else {
      failures.push(...checkText(text, spec, "text"))
      if (spec.language) {
        const detected = detectLanguage(text)
        if (detected !== "unknown" && detected !== spec.language) {
          warnings.push(
            `detected language "${detected}", expected "${spec.language}": review manually`,
          )
        }
      }
    }
  }

  return { passed: failures.length === 0, failures, warnings, needs_ai_check }
}
