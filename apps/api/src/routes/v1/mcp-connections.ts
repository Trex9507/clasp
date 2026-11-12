import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import {
  CreateMcpConnectionRequest,
  McpConnection,
  McpConnectionListResponse,
  McpConnectionParams,
  UpdateMcpConnectionRequest,
  WorkspaceParams,
} from "@clasp/shared"
import {
  createConnection,
  deleteConnection,
  discoverConnection,
  getConnection,
  listConnections,
  updateConnection,
  type McpDeps,
} from "../../mcp/mcp-connection-service.js"

export const mcpConnectionRoutes: FastifyPluginAsyncZod<Omit<McpDeps, "log">> = async (
  app,
  opts,
) => {
  const deps = (log: McpDeps["log"]): McpDeps => ({ ...opts, log })
  const base = "/workspaces/:workspaceId/mcp-connections"

  app.get(
    base,
    { schema: { params: WorkspaceParams, response: { 200: McpConnectionListResponse } } },
    async (req) => ({
      connections: await listConnections(deps(req.log), req.user, req.params.workspaceId),
    }),
  )

  app.post(
    base,
    {
      schema: {
        params: WorkspaceParams,
        body: CreateMcpConnectionRequest,
        response: { 201: McpConnection },
      },
    },
    async (req, reply) => {
      const body = { ...req.body, authType: req.body.authType ?? "none" }
      const connection = await createConnection(
        deps(req.log),
        req.user,
        req.params.workspaceId,
        body,
      )
      return reply.status(201).send(connection)
    },
  )

  app.get(
    `${base}/:connectionId`,
    { schema: { params: McpConnectionParams, response: { 200: McpConnection } } },
    (req) =>
      getConnection(deps(req.log), req.user, req.params.workspaceId, req.params.connectionId),
  )

  app.patch(
    `${base}/:connectionId`,
    {
      schema: {
        params: McpConnectionParams,
        body: UpdateMcpConnectionRequest,
        response: { 200: McpConnection },
      },
    },
    (req) =>
      updateConnection(
        deps(req.log),
        req.user,
        req.params.workspaceId,
        req.params.connectionId,
        req.body,
      ),
  )

  app.delete(
    `${base}/:connectionId`,
    { schema: { params: McpConnectionParams, response: { 204: z.null() } } },
    async (req, reply) => {
      await deleteConnection(
        deps(req.log),
        req.user,
        req.params.workspaceId,
        req.params.connectionId,
      )
      return reply.status(204).send(null)
    },
  )

  app.post(
    `${base}/:connectionId/discover`,
    { schema: { params: McpConnectionParams, response: { 200: McpConnection } } },
    (req) =>
      discoverConnection(deps(req.log), req.user, req.params.workspaceId, req.params.connectionId),
  )
}
