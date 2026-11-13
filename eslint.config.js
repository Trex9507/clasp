import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

// The model runtime is reached only through packages/runtime (CLAUDE.md, rule 3).
// The parked provider agents predate the platform and keep their direct client.
// Evals call the Messages API directly: to stub side-effecting tools and to run the judge.
const RUNTIME_SDK_ALLOWED = [
  "packages/runtime/**",
  "packages/provider-agents/**",
  "packages/evals/**",
]
const RUNTIME_SDK = {
  group: ["@anthropic-ai/*", "@anthropic-ai/sdk"],
  message: "Reach the model runtime through @clasp/runtime (CLAUDE.md, rule 3).",
}

// Layering in apps/api (CLAUDE.md, I3 and I4): routes call services; only services (and the
// auth seam, which resolves the user) call repositories; only repositories touch db/.
const REPOSITORY = {
  group: ["**/*-repository", "**/*-repository.js"],
  message: "Only services call repositories (CLAUDE.md, I3).",
}
const DB = {
  group: ["**/db/*", "!**/db/client.js"],
  message: "Routes never touch the database; call a service (CLAUDE.md, I4).",
}
const API_INTERNALS = {
  group: ["@clasp/api", "**/apps/api/**"],
  message: "The web app talks to the API over HTTP and shares types via @clasp/shared.",
}

// In flat config a later no-restricted-imports replaces an earlier one for the same file, so
// every block restates the runtime rule.
const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns: [RUNTIME_SDK, ...patterns] }],
})

export default defineConfig([
  globalIgnores([
    "**/dist",
    "**/coverage",
    "contracts/*/lib",
    "contracts/*/out",
    "contracts/*/cache",
    // Vite's dependency pre-bundle cache, present only after `vite dev` has run.
    "apps/web/.vite",
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
    // The web app runs in the browser and is built from React components.
    files: ["apps/web/**/*.{ts,tsx}"],
    ignores: ["apps/web/*.config.ts"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    // shadcn primitives are vendored, not authored here: `shadcn add --overwrite` replaces
    // them wholesale, so a fix applied to one is lost on the next update. react-refresh fires
    // on every file that exports its cva variants next to the component, which is shadcn's
    // own convention.
    files: ["apps/web/src/components/ui/**/*.{ts,tsx}", "apps/web/src/hooks/use-mobile.ts"],
    rules: {
      "react-refresh/only-export-components": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: RUNTIME_SDK_ALLOWED,
    rules: restrict(),
  },
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: [
      "apps/api/src/**/*-service.ts",
      "apps/api/src/**/*-repository.ts",
      "apps/api/src/**/*.test.ts",
      "apps/api/src/test/**",
      "apps/api/src/db/**",
      "apps/api/src/auth/current-user.ts",
    ],
    rules: restrict(REPOSITORY),
  },
  {
    files: ["apps/api/src/routes/**/*.ts"],
    ignores: ["apps/api/src/**/*.test.ts"],
    rules: restrict(REPOSITORY, DB),
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: restrict(API_INTERNALS),
  },
])
