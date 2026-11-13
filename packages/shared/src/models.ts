// The only place model IDs live (CLAUDE.md, section 6). IDs are provider-prefixed so a second
// provider can be added without migrating stored agents.

export interface ModelOption {
  /** Provider-prefixed ID stored on an agent version, e.g. "anthropic/claude-sonnet-5-5". */
  id: string
  provider: "anthropic"
  /** The provider's own model ID, sent to the runtime. */
  providerModelId: string
  label: string
  description: string
}

export const MODELS = [
  {
    id: "anthropic/claude-sonnet-5-5",
    provider: "anthropic",
    providerModelId: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    description: "Fast and capable. The best default for most agents.",
  },
  {
    id: "anthropic/claude-opus-5-5",
    provider: "anthropic",
    providerModelId: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    description: "Deeper reasoning for complex, multi-step work.",
  },
  {
    id: "anthropic/claude-haiku-5-5",
    provider: "anthropic",
    providerModelId: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    description: "Fastest and cheapest, for simple high-volume tasks.",
  },
  {
    id: "anthropic/claude-fable-5-2",
    provider: "anthropic",
    providerModelId: "claude-fable-5-2",
    label: "Claude Fable 5.2",
    description: "Most capable, for the hardest long-running work. Highest cost.",
  },
] as const satisfies readonly ModelOption[]

export type ModelId = (typeof MODELS)[number]["id"]

export const DEFAULT_MODEL_ID: ModelId = "anthropic/claude-sonnet-5-5"

export const MODEL_IDS = MODELS.map((m) => m.id) as [ModelId, ...ModelId[]]

export function findModel(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id)
}
