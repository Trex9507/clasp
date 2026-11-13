import { buildApp } from "./app.js"
import { loadConfig } from "./config.js"
import { createDatabase } from "./db/client.js"

const config = loadConfig()
const database = createDatabase(config.DATABASE_URL)

const app = await buildApp({
  config,
  db: database.db,
  logger:
    config.NODE_ENV === "development"
      ? { level: config.LOG_LEVEL, transport: { target: "pino-pretty" } }
      : { level: config.LOG_LEVEL },
})

app.addHook("onClose", () => database.close())

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close())
}

await app.listen({ port: config.API_PORT, host: config.API_HOST })
