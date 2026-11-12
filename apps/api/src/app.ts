import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify"
import cors from "@fastify/cors"
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod"
import type { Config } from "./config.js"
import type { Db } from "./db/client.js"
import { DomainError } from "./errors.js"
import { v1Routes } from "./routes/v1/index.js"

export interface AppDeps {
  config: Pick<Config, "CORS_ORIGINS" | "DEV_USER_EMAIL">
  db: Db
  logger?: FastifyServerOptions["logger"]
}

export async function buildApp({ config, db, logger = false }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Every failure leaves as `{ detail }`, the shape the web app's errorDetail() reads.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({ detail: error.message })
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
  await app.register(v1Routes, { prefix: "/api/v1", db, devUserEmail: config.DEV_USER_EMAIL })

  return app
}
