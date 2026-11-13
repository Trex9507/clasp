import {
  ActionPermission,
  AgentAction,
  AgentConfig,
  AgentVisibility,
  CreateAgentRequest,
  DEFAULT_LANGUAGE,
  DEFAULT_MODEL_ID,
  type Agent,
} from "@clasp/shared"
import { z } from "zod"

/**
 * One action as the web app edits it: the shared schema with its defaults resolved, so the
 * form's input and output types are the same (react-hook-form needs that) and every action
 * always carries an explicit permission and note.
 */
export const ActionFormSchema = z.object({
  connectionId: AgentAction.shape.connectionId,
  toolName: AgentAction.shape.toolName,
  permission: ActionPermission,
  usageNote: AgentAction.shape.usageNote.unwrap(),
})
export type ActionFormValues = z.infer<typeof ActionFormSchema>

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
  // The Configuration form never edits actions (the Actions tab does), but it must send them
  // back unchanged: a config PATCH replaces the whole config, so omitting them would wipe them.
  config: AgentConfig.extend({ actions: z.array(ActionFormSchema).max(200) }),
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
      actions: [],
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
      actions: versionActions(agent),
    },
  }
}

/** The current version's actions as the API accepts them back (no display-only fields). */
export function versionActions(agent: Agent): ActionFormValues[] {
  return agent.currentVersion.actions.map(({ connectionId, toolName, permission, usageNote }) => ({
    connectionId,
    toolName,
    permission,
    usageNote,
  }))
}
