// Request and response contracts between apps/web and apps/api. The API validates and
// serializes with these schemas; the web app types its calls with the inferred types.
import { z } from "zod"
import { LANGUAGE_CODES } from "./languages.js"
import { MODEL_IDS } from "./models.js"

export const ErrorResponse = z.object({ detail: z.string() })
export type ErrorResponse = z.infer<typeof ErrorResponse>

export const WorkspaceKind = z.enum(["personal", "organization"])
export const WorkspaceRole = z.enum(["owner", "admin", "member"])

export const User = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
})
export type User = z.infer<typeof User>

export const Workspace = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: WorkspaceKind,
  role: WorkspaceRole,
})
export type Workspace = z.infer<typeof Workspace>

export const MeResponse = z.object({
  user: User,
  workspaces: z.array(Workspace),
})
export type MeResponse = z.infer<typeof MeResponse>

export const ModelOptionSchema = z.object({
  id: z.string(),
  provider: z.literal("anthropic"),
  providerModelId: z.string(),
  label: z.string(),
  description: z.string(),
})

export const ModelsResponse = z.object({
  models: z.array(ModelOptionSchema),
  defaultModelId: z.string(),
})
export type ModelsResponse = z.infer<typeof ModelsResponse>

export const WorkspaceParams = z.object({ workspaceId: z.uuid() })
export type WorkspaceParams = z.infer<typeof WorkspaceParams>

// --- Agents ----------------------------------------------------------------------------------

export const AgentStatus = z.enum(["active", "archived"])
export type AgentStatus = z.infer<typeof AgentStatus>

// "listed" (marketplace) is reserved in the database but not settable yet.
export const AgentVisibility = z.enum(["private", "workspace"])
export type AgentVisibility = z.infer<typeof AgentVisibility>

export const Effort = z.enum(["low", "medium", "high"])
export type Effort = z.infer<typeof Effort>

/** Everything that defines how an agent behaves. A change to any of it creates a new version. */
export const AgentConfig = z.object({
  model: z.enum(MODEL_IDS),
  language: z.enum(LANGUAGE_CODES),
  effort: Effort,
  systemPrompt: z.string().trim().min(1, "Write a system prompt").max(50_000),
})
export type AgentConfig = z.infer<typeof AgentConfig>

const AgentName = z.string().trim().min(1, "Give the agent a name").max(80)
const AgentDescription = z.string().trim().max(500)
const AgentIcon = z.string().trim().max(8)

export const CreateAgentRequest = z.object({
  name: AgentName,
  description: AgentDescription.default(""),
  icon: AgentIcon.default(""),
  visibility: AgentVisibility.default("private"),
  config: AgentConfig,
})
export type CreateAgentRequest = z.input<typeof CreateAgentRequest>

export const UpdateAgentRequest = z
  .object({
    name: AgentName,
    description: AgentDescription,
    icon: AgentIcon,
    visibility: AgentVisibility,
    config: AgentConfig,
  })
  .partial()
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequest>

export const AgentVersion = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  model: z.string(),
  language: z.string(),
  effort: Effort,
  systemPrompt: z.string(),
  /** False when the runtime could not be updated yet; POST .../sync retries. */
  runtimeSynced: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  createdBy: User,
})
export type AgentVersion = z.infer<typeof AgentVersion>

export const Agent = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  status: AgentStatus,
  visibility: AgentVisibility,
  currentVersion: AgentVersion,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type Agent = z.infer<typeof Agent>

export const AgentSummary = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  status: AgentStatus,
  visibility: AgentVisibility,
  model: z.string(),
  language: z.string(),
  version: z.number().int().positive(),
  actionCount: z.number().int().nonnegative(),
  runtimeSynced: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type AgentSummary = z.infer<typeof AgentSummary>

export const AgentListQuery = z.object({ status: AgentStatus.default("active") })
export const AgentListResponse = z.object({ agents: z.array(AgentSummary) })
export type AgentListResponse = z.infer<typeof AgentListResponse>

export const AgentVersionsResponse = z.object({ versions: z.array(AgentVersion) })
export type AgentVersionsResponse = z.infer<typeof AgentVersionsResponse>

export const AgentParams = WorkspaceParams.extend({ agentId: z.uuid() })
export type AgentParams = z.infer<typeof AgentParams>
