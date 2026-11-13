import { FakeRuntime, ManagedAgentsRuntime } from "@clasp/runtime"
import { buildApp } from "./app.js"
import { loadConfig } from "./config.js"
import { createDatabase } from "./db/client.js"

const config = loadConfig()
const database = createDatabase(config.DATABASE_URL)

const runtime = config.ANTHROPIC_API_KEY
  ? new ManagedAgentsRuntime({ apiKey: config.ANTHROPIC_API_KEY })
  : new FakeRuntime()

const app = await buildApp({
  config,
  db: database.db,
  runtime,
  logger:
    config.NODE_ENV === "development"
      ? { level: config.LOG_LEVEL, transport: { target: "pino-pretty" } }
      : { level: config.LOG_LEVEL },
})

if (runtime instanceof FakeRuntime) {
  app.log.warn("ANTHROPIC_API_KEY is not set: agents are hosted on the in-memory FakeRuntime")
}

app.addHook("onClose", () => database.close())

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close())
}

await app.listen({ port: config.API_PORT, host: config.API_HOST })
