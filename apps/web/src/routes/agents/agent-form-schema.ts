import {
  AgentConfig,
  AgentVisibility,
  CreateAgentRequest,
  DEFAULT_LANGUAGE,
  DEFAULT_MODEL_ID,
  type Agent,
} from "@clasp/shared"
import { z } from "zod"

/**
 * The form behind both "Create agent" and an agent's Configuration tab.
 *
 * Its schema is the create request with every field required: the request's defaults exist for
 * API callers that omit a field, while the form always has a value to show. The same field
 * schemas back both, so the form cannot accept what the API would reject.
 */
export const AgentFormSchema = z.object({
  name: CreateAgentRequest.shape.name,
  description: CreateAgentRequest.shape.description.unwrap(),
  icon: CreateAgentRequest.shape.icon.unwrap(),
  visibility: AgentVisibility,
  config: AgentConfig,
})
export type AgentFormValues = z.infer<typeof AgentFormSchema>

export const SYSTEM_PROMPT_MAX = 50_000

export function emptyAgentForm(): AgentFormValues {
  return {
    name: "",
    description: "",
    icon: "",
    visibility: "private",
    config: {
      model: DEFAULT_MODEL_ID,
      language: DEFAULT_LANGUAGE,
      effort: "medium",
      systemPrompt: "",
    },
  }
}

export function agentToForm(agent: Agent): AgentFormValues {
  const version = agent.currentVersion
  return {
    name: agent.name,
    description: agent.description,
    icon: agent.icon,
    visibility: agent.visibility,
    config: {
      // The version stores plain strings; a model retired from the catalog then fails
      // validation on save, which is the moment to pick a new one.
      model: version.model as AgentFormValues["config"]["model"],
      language: version.language as AgentFormValues["config"]["language"],
      effort: version.effort,
      systemPrompt: version.systemPrompt,
    },
  }
}
