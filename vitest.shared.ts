import { defineConfig } from "vitest/config"

// Workspace packages export their TypeScript sources under this condition,
// so tests run against src/ without a build step.
const conditions = ["@clasp/source", "module", "node", "development|production"]

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: { environment: "node" },
})
