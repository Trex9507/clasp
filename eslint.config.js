import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

// The model runtime is reached only through packages/runtime (CLAUDE.md, rule 3).
// The parked provider agents predate the platform and keep their direct client.
const RUNTIME_SDK_ALLOWED = ["packages/runtime/**", "packages/provider-agents/**"]

export default defineConfig([
  globalIgnores([
    "**/dist",
    "**/coverage",
    "contracts/*/lib",
    "contracts/*/out",
    "contracts/*/cache",
  ]),
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: RUNTIME_SDK_ALLOWED,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@anthropic-ai/*", "@anthropic-ai/sdk"],
              message: "Reach the model runtime through @clasp/runtime (CLAUDE.md, rule 3).",
            },
          ],
        },
      ],
    },
  },
])
