import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import {
  Agent,
  AgentListQuery,
  AgentListResponse,
  AgentParams,
  AgentVersionsResponse,
  CreateAgentRequest,
  UpdateAgentRequest,
  WorkspaceParams,
} from "@clasp/shared"
import {
  archiveAgent,
  createAgent,
  getAgent,
  listAgents,
  listAgentVersions,
  syncAgent,
  updateAgent,
  type AgentDeps,
} from "../../agents/agent-service.js"

export const agentRoutes: FastifyPluginAsyncZod<Omit<AgentDeps, "log">> = async (app, opts) => {
  const deps = (log: AgentDeps["log"]): AgentDeps => ({ ...opts, log })
  const base = "/workspaces/:workspaceId/agents"

  app.get(
    base,
    {
      schema: {
        params: WorkspaceParams,
        querystring: AgentListQuery,
        response: { 200: AgentListResponse },
      },
    },
    async (req) => ({
      agents: await listAgents(deps(req.log), req.user, req.params.workspaceId, req.query.status),
    }),
  )

  app.post(
    base,
    { schema: { params: WorkspaceParams, body: CreateAgentRequest, response: { 201: Agent } } },
    async (req, reply) => {
      const agent = await createAgent(deps(req.log), req.user, req.params.workspaceId, req.body)
      return reply.status(201).send(agent)
    },
  )

  app.get(
    `${base}/:agentId`,
    { schema: { params: AgentParams, response: { 200: Agent } } },
    (req) => getAgent(deps(req.log), req.user, req.params.workspaceId, req.params.agentId),
  )

  app.patch(
    `${base}/:agentId`,
    { schema: { params: AgentParams, body: UpdateAgentRequest, response: { 200: Agent } } },
    (req) =>
      updateAgent(deps(req.log), req.user, req.params.workspaceId, req.params.agentId, req.body),
  )

  app.delete(
    `${base}/:agentId`,
    { schema: { params: AgentParams, response: { 204: z.null() } } },
    async (req, reply) => {
      await archiveAgent(deps(req.log), req.user, req.params.workspaceId, req.params.agentId)
      return reply.status(204).send(null)
    },
  )

  app.get(
    `${base}/:agentId/versions`,
    { schema: { params: AgentParams, response: { 200: AgentVersionsResponse } } },
    async (req) => ({
      versions: await listAgentVersions(
        deps(req.log),
        req.user,
        req.params.workspaceId,
        req.params.agentId,
      ),
    }),
  )

  app.post(
    `${base}/:agentId/sync`,
    { schema: { params: AgentParams, response: { 200: Agent } } },
    (req) => syncAgent(deps(req.log), req.user, req.params.workspaceId, req.params.agentId),
  )
}
