// Request and response contracts between apps/web and apps/api. The API validates and
// serializes with these schemas; the web app types its calls with the inferred types.
import { z } from "zod"

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
