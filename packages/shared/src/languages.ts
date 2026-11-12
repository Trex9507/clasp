// Response languages an agent can be set to. BCP-47 codes; labels are each language's own name
// next to its English name so a speaker can find theirs.

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano (Italian)" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "fr", label: "Français (French)" },
  { code: "de", label: "Deutsch (German)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "nl", label: "Nederlands (Dutch)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "ja", label: "日本語 (Japanese)" },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]["code"]

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]]

export const DEFAULT_LANGUAGE: LanguageCode = "en"
