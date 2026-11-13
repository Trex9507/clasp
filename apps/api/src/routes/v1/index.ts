// Routes hold no business logic and never touch the database directly (CLAUDE.md, I4): they
// validate input, call a service, and return the result.
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import {
  DEFAULT_MODEL_ID,
  MeResponse,
  PlatformResponse,
  MODELS,
  ModelsResponse,
  Workspace,
  WorkspaceParams,
} from "@clasp/shared"
import type { AgentRuntime } from "@clasp/runtime"
import type { Db } from "../../db/client.js"
import { agentRoutes } from "./agents.js"
import { mcpConnectionRoutes } from "./mcp-connections.js"
import { runRoutes } from "./runs.js"
import type { SecretBox } from "../../crypto.js"
import type { DiscoverTools } from "../../mcp/discovery.js"
import { registerCurrentUser } from "../../auth/current-user.js"
import { assertWorkspaceAccess, getMe } from "../../workspaces/workspace-service.js"

export interface V1Options {
  db: Db
  runtime: AgentRuntime
  devUserEmail: string
  discover: DiscoverTools
  allowPrivateHosts: boolean
  secrets: SecretBox | undefined
  runBudgetCents: number
}

export const v1Routes: FastifyPluginAsyncZod<V1Options> = async (
  app,
  { db, runtime, devUserEmail, discover, allowPrivateHosts, secrets, runBudgetCents },
) => {
  registerCurrentUser(app, db, devUserEmail)

  app.get("/me", { schema: { response: { 200: MeResponse } } }, (request) =>
    getMe(db, request.user),
  )

  app.get("/platform", { schema: { response: { 200: PlatformResponse } } }, async () => ({
    runtime: { provider: runtime.provider, simulated: runtime.provider === "fake" },
  }))

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
  await app.register(mcpConnectionRoutes, { db, runtime, discover, allowPrivateHosts, secrets })
  await app.register(runRoutes, { db, runtime, budgetCents: runBudgetCents })
}
