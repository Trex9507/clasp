import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod"
import { z } from "zod"
import {
  AgentParams,
  RunListResponse,
  RunParams,
  RunWithEvents,
  SendRunMessageRequest,
  ToolDecisionRequest,
} from "@clasp/shared"
import {
  assertRunAccess,
  decideRunTool,
  getRun,
  interruptRun,
  listRuns,
  sendRunMessage,
  startRun,
  streamRun,
  type RunDeps,
} from "../../runs/run-service.js"

const HEARTBEAT_MS = 15_000

export const runRoutes: FastifyPluginAsyncZod<Omit<RunDeps, "log">> = async (app, opts) => {
  const deps = (log: RunDeps["log"]): RunDeps => ({ ...opts, log })
  const runBase = "/workspaces/:workspaceId/runs/:runId"

  app.post(
    "/workspaces/:workspaceId/agents/:agentId/runs",
    { schema: { params: AgentParams, response: { 201: RunWithEvents } } },
    async (req, reply) => {
      const run = await startRun(
        deps(req.log),
        req.user,
        req.params.workspaceId,
        req.params.agentId,
      )
      return reply.status(201).send(run)
    },
  )

  app.get(
    "/workspaces/:workspaceId/agents/:agentId/runs",
    { schema: { params: AgentParams, response: { 200: RunListResponse } } },
    async (req) => ({
      runs: await listRuns(deps(req.log), req.user, req.params.workspaceId, req.params.agentId),
    }),
  )

  app.get(runBase, { schema: { params: RunParams, response: { 200: RunWithEvents } } }, (req) =>
    getRun(deps(req.log), req.user, req.params.workspaceId, req.params.runId),
  )

  app.post(
    `${runBase}/messages`,
    { schema: { params: RunParams, body: SendRunMessageRequest, response: { 204: z.null() } } },
    async (req, reply) => {
      const { workspaceId, runId } = req.params
      await sendRunMessage(deps(req.log), req.user, workspaceId, runId, req.body.text)
      return reply.status(204).send(null)
    },
  )

  app.post(
    `${runBase}/tool-decisions`,
    { schema: { params: RunParams, body: ToolDecisionRequest, response: { 204: z.null() } } },
    async (req, reply) => {
      await decideRunTool(
        deps(req.log),
        req.user,
        req.params.workspaceId,
        req.params.runId,
        req.body,
      )
      return reply.status(204).send(null)
    },
  )

  app.post(
    `${runBase}/interrupt`,
    { schema: { params: RunParams, response: { 204: z.null() } } },
    async (req, reply) => {
      await interruptRun(deps(req.log), req.user, req.params.workspaceId, req.params.runId)
      return reply.status(204).send(null)
    },
  )

  // Server-Sent Events: history first, then live events. Each message is one RunEvent.
  app.get(`${runBase}/events`, { schema: { params: RunParams } }, async (req, reply) => {
    const { workspaceId, runId } = req.params
    // Fail as JSON (404, 409) before switching the response to an event stream.
    await assertRunAccess(deps(req.log), req.user, workspaceId, runId)

    const controller = new AbortController()
    req.raw.on("close", () => controller.abort())
    reply.hijack()
    reply.raw.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    })
    reply.raw.write("retry: 2000\n\n")
    const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), HEARTBEAT_MS)

    try {
      for await (const event of streamRun(
        deps(req.log),
        req.user,
        workspaceId,
        runId,
        controller.signal,
      )) {
        reply.raw.write(`id: ${event.id}\nevent: run-event\ndata: ${JSON.stringify(event)}\n\n`)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        req.log.warn({ err: error, runId }, "run stream failed")
        const message = error instanceof Error ? error.message : "The run stream failed"
        const event = {
          id: `stream-error-${Date.now()}`,
          at: new Date().toISOString(),
          kind: "error",
          message,
        }
        reply.raw.write(`event: run-event\ndata: ${JSON.stringify(event)}\n\n`)
      }
    } finally {
      clearInterval(heartbeat)
      reply.raw.end()
    }
  })
}
