import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify"
import cors from "@fastify/cors"
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod"
import type { Config } from "./config.js"
import type { AgentRuntime } from "@clasp/runtime"
import type { Db } from "./db/client.js"
import { RuntimeError } from "@clasp/runtime"
import { DomainError } from "./errors.js"
import { createSecretBox } from "./crypto.js"
import { discoverTools, type DiscoverTools } from "./mcp/discovery.js"
import { v1Routes } from "./routes/v1/index.js"

export interface AppDeps {
  config: Pick<
    Config,
    | "CORS_ORIGINS"
    | "DEV_USER_EMAIL"
    | "CREDENTIAL_ENCRYPTION_KEY"
    | "MCP_ALLOW_PRIVATE_HOSTS"
    | "NODE_ENV"
    | "RUN_BUDGET_CENTS"
  >
  db: Db
  runtime: AgentRuntime
  /** Injectable for tests. */
  discover?: DiscoverTools
  logger?: FastifyServerOptions["logger"]
}

export async function buildApp({
  config,
  db,
  runtime,
  discover = discoverTools,
  logger = false,
}: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Every failure leaves as `{ detail }`, the shape the web app's errorDetail() reads.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({ detail: error.message })
    }
    if (error instanceof RuntimeError) {
      // The hosting runtime failed; its message is safe to show and says what to retry.
      request.log.warn({ err: error }, "runtime call failed")
      return reply.status(502).send({ detail: error.message })
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const detail = error.validation
        .map((v) => `${v.instancePath || error.validationContext || "request"}: ${v.message}`)
        .join("; ")
      return reply.status(422).send({ detail })
    }
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, "response failed its schema")
      return reply.status(500).send({ detail: "Internal server error" })
    }
    const status = (error as { statusCode?: number }).statusCode
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send({ detail: (error as Error).message })
    }
    request.log.error({ err: error }, "unhandled error")
    return reply.status(500).send({ detail: "Internal server error" })
  })
  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ detail: "Not found" }))

  await app.register(cors, { origin: config.CORS_ORIGINS })

  app.get("/health", async () => ({ status: "ok" }))
  await app.register(v1Routes, {
    prefix: "/api/v1",
    db,
    runtime,
    devUserEmail: config.DEV_USER_EMAIL,
    discover,
    allowPrivateHosts: config.MCP_ALLOW_PRIVATE_HOSTS ?? config.NODE_ENV !== "production",
    secrets: config.CREDENTIAL_ENCRYPTION_KEY
      ? createSecretBox(config.CREDENTIAL_ENCRYPTION_KEY)
      : undefined,
    runBudgetCents: config.RUN_BUDGET_CENTS,
  })

  return app
}
