import { z } from "zod"

// Read once at startup and fail fast: a missing or malformed setting stops the process with a
// message naming it, instead of surfacing later as an obscure runtime error.
const ConfigSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default("127.0.0.1"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Login is deferred: every request runs as this seeded user (see auth/current-user.ts).
  DEV_USER_EMAIL: z.email().default("dev@clasp.local"),
  // Without a key the API hosts agents on the in-memory FakeRuntime (see server.ts).
  // 32 bytes, base64 (`openssl rand -base64 32`). Needed only to save MCP bearer tokens.
  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  // Let MCP discovery reach loopback/private addresses. Defaults to on outside production.
  MCP_ALLOW_PRIVATE_HOSTS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),
})

export type Config = z.infer<typeof ConfigSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`)
    throw new Error(`Invalid configuration:\n${problems.join("\n")}\nSee .env.example.`)
  }
  return parsed.data
}
