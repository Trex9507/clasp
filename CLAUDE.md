# CLAUDE.md - Clasp engineering guidelines

Binding on every file in this repository. Read automatically by Claude Code.

## 0. How to read this file

A rule belongs here only if one sentence says what breaks without it and this file names the
check that catches it. Real guidance that no check can enforce goes in section 11, labelled as a
convention. Never write a count in this file: name the list instead, because counts go stale.

**If a task seems to require breaking a rule, stop and ask.** Name the decision, the options and
your recommendation. Do not work around a guard, and never weaken a test to make a build pass.

### The four that never move

1. **Every read and write is scoped to a workspace.** Repositories take `workspaceId` as a
   required argument. _Enforced by: `tests/guards/workspace-scope.test.ts` (its `EXEMPT` map
   names each unscoped function and why) and the cross-workspace tests in
   `apps/api/src/routes/v1/foundation.test.ts`, `agents/agents.test.ts` and `runs/runs.test.ts`._
2. **No secret leaves the server.** No credential field on any response schema; logs redact
   secrets. _Enforced by: `tests/guards/no-secret-in-response.test.ts`, which walks every response
   schema in `packages/shared/src/api.ts` (`*Request` schemas carry secrets inbound and are
   exempt), and the bearer-token test in `apps/api/src/mcp/mcp-connections.test.ts`._
3. **The model runtime is reached only through `packages/runtime`.** _Enforced by: the
   `no-restricted-imports` rule in `eslint.config.js` (`@anthropic-ai/*` is allowed only in
   `packages/runtime`, the parked `packages/provider-agents`, and `packages/evals`, which calls
   the Messages API to stub tools and to run the judge)._
4. **English only, and never an em dash**, in every tracked text file: code, comments, prompts,
   UI copy, docs, commit messages and PR descriptions. Use a plain hyphen or restructure the
   sentence. _Enforced by: `tests/guards/prose.test.ts`, whose `ALLOWED` map names every file
   exempted and why. Vendored skills under `.claude/skills/` are exempt because they stay
   byte-identical to their verified upstream; their style never overrides this rule._

## 1. Product context

Clasp is an agent platform for B2C and B2B. A user builds an agent (system prompt, model,
response language, effort) and gives it **actions**: tools discovered from the MCP servers the
user connects, each set to "Ask me first" or "Run automatically". Clasp hosts the agent on Claude
Managed Agents, and the Playground lets the user chat with it, approve actions and see what each
run costs. Individuals work in a personal workspace; companies share an organization workspace.

The marketplace (listing agents and earning from them) and monetization come later. **Do not build
marketplace, billing or payout features without asking.** Keep the seams that make them possible:
immutable agent versions, the `agent_runs` usage ledger, and the reserved `listed` visibility.

The original escrow prototype (packages `escrow-mcp-server`, `verifier`, `provider-agents`,
`contracts/escrow`, `db/escrow`) is **parked**: keep it green, add no features without asking.

## 2. Platform invariants

| #   | Invariant                                                                                                    | Enforced by                                                           |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| I1  | The Clasp database is the source of truth; the runtime only holds what `runtime_ref` names                   | `apps/api/src/agents/agents.test.ts` (runtime down, then sync)        |
| I2  | `agent_versions` rows are immutable; a configuration edit creates a new version                              | trigger in `apps/api/drizzle/0002_*` and its test in `agents.test.ts` |
| I3  | One writer per aggregate: agents (`AgentService`), connections (`McpConnectionService`), runs (`RunService`) | `tests/guards/single-writer.test.ts`                                  |
| I4  | Routes hold no business logic, never import `db/` and never call repositories                                | `DB` and `REPOSITORY` patterns in `eslint.config.js`                  |
| I5  | Every run writes an `agent_runs` row with its usage                                                          | `apps/api/src/runs/runs.test.ts` (usage on the ledger)                |
| I6  | `request.user` is set only in `apps/api/src/auth/current-user.ts` (login is deferred)                        | `tests/guards/auth-seam.test.ts`                                      |

## 3. Layering

```
apps/web            -> packages/shared
apps/api routes     -> services, packages/shared
services            -> repositories, other services' exported functions, packages/runtime, packages/shared
auth seam           -> user repository
repositories        -> db
packages/runtime    -> packages/shared
packages/shared     -> (nothing internal)
```

A service may read another aggregate's repository but writes only its own (I3); to change another
aggregate it calls the owning service (for example, `RunService` asks `AgentService` to re-host an
agent). `eslint.config.js` enforces the route arrows (`DB`, `REPOSITORY`) and keeps `apps/web`
from importing API internals (`API_INTERNALS`).

## 4. Layout and commands

See [README.md](README.md) for the layout and local setup. Commands, all from the repository root:

| Command                                           | What it does                                                 |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm test`                                       | guard tests, then every package's tests                      |
| `pnpm test:guards`                                | only the repository-wide guards in `tests/guards/`           |
| `pnpm lint` / `pnpm typecheck`                    | ESLint over the repo / `tsc --noEmit` in every package       |
| `pnpm format` / `pnpm format:check`               | Prettier                                                     |
| `pnpm build`                                      | build every package                                          |
| `pnpm --filter <package> <script>`                | run one package's script                                     |
| `docker compose up -d postgres`                   | local Postgres on port 5433                                  |
| `pnpm --filter @clasp/api db:generate`            | write a migration after changing `apps/api/src/db/schema.ts` |
| `pnpm --filter @clasp/api db:migrate` / `db:seed` | apply migrations / create the development user               |
| `pnpm --filter @clasp/api dev` / `@clasp/web dev` | API on :3001 / web app on :5173 (proxies `/api`)             |
| `cd contracts/escrow && forge test`               | contract tests (needs Foundry and initialised submodules)    |

CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, test and build, the contract tests,
and a gitleaks secret scan.

## 5. TypeScript and data

- Strict TypeScript from `tsconfig.base.json`; every package extends it.
- Workspace packages export their sources under the `@clasp/source` condition, so dev, tests and
  typecheck read `src/` while `node dist/` reads the build. Add the condition to any new package.
- Validate with zod at every boundary. API contracts live in `packages/shared/src/api.ts`; the
  escrow `JobSpec` schema lives in `packages/verifier` and nowhere else.
- Database changes go through `drizzle-kit generate`. Never edit an applied migration; Postgres
  rules that Drizzle cannot express (such as the I2 trigger) go in a `--custom` migration.

## 6. Runtime and models

- Load the `claude-api` skill (its Managed Agents docs) before touching `packages/runtime`. Never
  guess SDK bindings; read the installed SDK types.
- The API picks the runtime at startup: `ManagedAgentsRuntime` when `ANTHROPIC_API_KEY` is set,
  otherwise the in-memory `FakeRuntime`, which simulates replies and tool calls. `GET /platform`
  tells the web app which one is active so it can show the simulated-runtime banner.
- Each Clasp agent maps to one runtime agent, updated in place on every save; runtime agents are
  provisioned when a version is saved, never per run. Each workspace has one vault for its MCP
  credentials. All sessions share one runtime environment (limited networking, MCP servers only).
- A run is a session pinned to the runtime version of the agent's current Clasp version, with the
  workspace vault and a spending cap (`RUN_BUDGET_CENTS`). Its events are normalized into
  `RunEvent` in `packages/runtime/src/managed-agents-events.ts`.
- Model IDs come only from `packages/shared/src/models.ts`, provider-prefixed
  (`anthropic/claude-sonnet-5-5`).

## 7. Testing

- Vitest everywhere. API integration tests run against Postgres in testcontainers, so Docker
  must be running.
- API tests use `FakeRuntime` and a real in-process MCP server (`apps/api/src/test/mcp-server.ts`).
  The live Managed Agents contract test runs only with `ANTHROPIC_API_KEY` and
  `CLASP_LIVE_RUNTIME_TESTS=1`, because it creates and archives a real agent.
- Web tests use Testing Library with mocked `fetch` and a mock `EventSource`
  (`apps/web/src/test/`).
- Check UI changes in a real browser with the pinned `playwright` MCP server (section 9).

## 8. Security

- Configuration comes from env, validated by zod at startup (`apps/api/src/config.ts`). `.env` is
  never committed.
- MCP bearer tokens are encrypted at rest with AES-256-GCM (`apps/api/src/crypto.ts`, key in
  `CREDENTIAL_ENCRYPTION_KEY`) and mirrored into the workspace's runtime vault; the API returns
  `hasCredential`, never the value.
- MCP discovery refuses private and loopback addresses unless `MCP_ALLOW_PRIVATE_HOSTS` allows
  them; it defaults to allowed only outside production (SSRF).
- Every run has a hard spending cap enforced by the runtime.
- Skills, plugins and MCP servers are added only after a verification report (source, license,
  every file read, red flags) and explicit approval. Vendored skills carry a `SOURCE.md`.

## 9. Skills, plugins and MCP servers

Configured in `.claude/settings.json` (plugins from `claude-plugins-official`), `.mcp.json`
(pinned MCP servers) and `.claude/skills/` (vendored skills, each with a `SOURCE.md`). When to
reach for them:

| Tool                                                                | Use it for                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `frontend-design` plugin                                            | new UI or reshaping existing UI                                           |
| `react-best-practices` skill                                        | React performance and patterns (skip its Next.js server-only rules)       |
| `minimalist-ui` skill                                               | opt-in only, by name; where it conflicts with our shadcn setup, ours wins |
| `playwright` MCP (`.mcp.json`, pinned)                              | checking a UI change in a real browser                                    |
| `pr-review-toolkit` plugin, `/code-review`                          | reviewing a change before opening a PR                                    |
| `feature-dev` plugin                                                | planning and building a larger feature                                    |
| `mcp-server-dev` plugin, `mcp-builder` skill                        | MCP connection and server work                                            |
| `claude-api` skill (built in)                                       | anything touching `packages/runtime` or Claude models                     |
| `typescript-lsp`, `claude-md-management`, `commit-commands` plugins | navigation, keeping this file current, commits                            |

`commit-commands` can push and open a PR in one step (`/commit-push-pr`) and force-delete branches
(`/clean_gone`): use those only when asked. Never add a skill, plugin or MCP server without a
verification report and approval; pin every MCP server version.

## 10. Evals

`packages/evals` measures the agent behavior Clasp's code controls; see
[docs/evals.md](docs/evals.md) for the method, the suites and every case.

| Rule                                                                                                                                             | Enforced by                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| A change to agent-facing behavior (the runtime adapter, prompts, model or language catalogs, agent and run services) must not regress the suites | `.github/workflows/evals.yml` runs them against `packages/evals/baselines/` on such pull requests          |
| A guardrail score (`no_forbidden_tools`, `no_canary`) may not drop at all; other scores may move within 0.05 of noise                            | `findRegressions` in `packages/evals/src/baseline.ts` and its test                                         |
| A run never spends more than its budget (`EVAL_BUDGET_USD`)                                                                                      | `CostMeter` in `packages/evals/src/cost.ts` and its test                                                   |
| Code scorers are calibrated on clear passes and fails before they grade anything                                                                 | `packages/evals/src/evals.test.ts`, run in every CI build                                                  |
| The model under test never judges itself                                                                                                         | `JUDGE_MODEL` (Opus) differs from the platform default (`SUBJECT_MODEL`) in `packages/evals/src/config.ts` |

Conventions that go with them (not enforced): every agent-behavior bug becomes a dataset case;
change one variable per experiment; update a baseline only after reading the results that
produced it, in the same pull request, saying why; calibrate a new judge criterion against a few
hand-labelled replies before trusting it.

## 11. Conventions (not enforced)

- Branch names start with `feature/`, `chore/` or `fix/`.
- Commits follow Conventional Commits; one PR per milestone; CI green before merge.
- Comments explain why, not what.
- `.env.example` lists every key the code reads, with no values.
- Prefer one well-named function over a flag that switches between two behaviours.
- Every web page loads lazily from `apps/web/src/app-routes.tsx`; libraries go to the named vendor
  chunks in `apps/web/vite.config.ts`, which keeps every chunk under Vite's size warning.
