// Routes hold no business logic and never touch the database directly (CLAUDE.md, I4): they
// validate input, call a service, and return the result.
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import {
  DEFAULT_MODEL_ID,
  MeResponse,
  MODELS,
  ModelsResponse,
  Workspace,
  WorkspaceParams,
} from "@clasp/shared"
import type { AgentRuntime } from "@clasp/runtime"
import type { Db } from "../../db/client.js"
import { agentRoutes } from "./agents.js"
import { registerCurrentUser } from "../../auth/current-user.js"
import { assertWorkspaceAccess, getMe } from "../../workspaces/workspace-service.js"

export interface V1Options {
  db: Db
  runtime: AgentRuntime
  devUserEmail: string
}

export const v1Routes: FastifyPluginAsyncZod<V1Options> = async (
  app,
  { db, runtime, devUserEmail },
) => {
  registerCurrentUser(app, db, devUserEmail)

  app.get("/me", { schema: { response: { 200: MeResponse } } }, (request) =>
    getMe(db, request.user),
  )

  app.get("/models", { schema: { response: { 200: ModelsResponse } } }, async () => ({
    models: [...MODELS],
    defaultModelId: DEFAULT_MODEL_ID,
  }))

  app.get(
    "/workspaces/:workspaceId",
    { schema: { params: WorkspaceParams, response: { 200: Workspace } } },
    (request) => assertWorkspaceAccess(db, request.params.workspaceId, request.user.id),
  )

  await app.register(agentRoutes, { db, runtime })
}
