import {
  LANGUAGES,
  type ActionPermission,
  MODELS,
  type AgentVisibility,
  type Effort,
  type ModelsResponse,
} from "@clasp/shared"

import { useModels } from "@/lib/queries"

export type ModelChoice = ModelsResponse["models"][number]

/**
 * The model catalog, from the API when it has answered and from the shared list until then.
 * Both come from `packages/shared/src/models.ts`, so the fallback never disagrees.
 */
export function useModelCatalog(): ModelChoice[] {
  const models = useModels()
  return models.data?.models ?? [...MODELS]
}

/** A model's label, or its raw id when the catalog no longer lists it. */
export function modelLabel(catalog: ModelChoice[], id: string): string {
  return catalog.find((model) => model.id === id)?.label ?? id
}

export function languageLabel(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.label ?? code
}

export const EFFORT_OPTIONS: { value: Effort; label: string; description: string }[] = [
  { value: "low", label: "Low", description: "Fastest and cheapest." },
  { value: "medium", label: "Medium", description: "Balanced. The default." },
  { value: "high", label: "High", description: "Most thorough, slower and costlier." },
]

export function effortLabel(effort: Effort): string {
  return EFFORT_OPTIONS.find((option) => option.value === effort)?.label ?? effort
}

export const VISIBILITY_OPTIONS: {
  value: AgentVisibility
  label: string
  description: string
}[] = [
  { value: "private", label: "Private", description: "Only you." },
  { value: "workspace", label: "Workspace", description: "Everyone in this workspace." },
]

export const PERMISSION_OPTIONS: {
  value: ActionPermission
  label: string
  description: string
}[] = [
  {
    value: "ask",
    label: "Ask me first",
    description: "The agent pauses and waits for your approval before each use.",
  },
  {
    value: "auto",
    label: "Run automatically",
    description: "The agent uses it whenever it decides to, without asking.",
  },
]

export function permissionLabel(permission: ActionPermission): string {
  return PERMISSION_OPTIONS.find((option) => option.value === permission)?.label ?? permission
}
