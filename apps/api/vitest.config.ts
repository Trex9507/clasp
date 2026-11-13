import { defineConfig, mergeConfig } from "vitest/config"
import shared from "../../vitest.shared.js"

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      globalSetup: ["./src/test/global-setup.ts"],
      // One container serves every file; truncation between tests needs files to run serially.
      fileParallelism: false,
      hookTimeout: 120_000,
    },
  }),
)
