import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { include: ["tests/guards/**/*.test.ts"], environment: "node" },
})
