# CLAUDE.md - Clasp engineering guidelines

Binding on every file in this repository. Read automatically by Claude Code.

## 0. How to read this file

A rule belongs here only if one sentence says what breaks without it and this file names the
check that catches it. Real guidance that no check can enforce goes in section 9, labelled as a
convention. Never write a count in this file: name the list instead, because counts go stale.

**If a task seems to require breaking a rule, stop and ask.** Name the decision, the options and
your recommendation. Do not work around a guard, and never weaken a test to make a build pass.

### The four that never move

1. **Every read and write is scoped to a workspace.** Repositories take `workspaceId` as a
   required argument. _Enforced by: `tests/guards/workspace-scope.test.ts` (its `EXEMPT` map names each unscoped
   function and why) and the cross-workspace tests in `apps/api/src/routes/v1/foundation.test.ts`._
2. **No secret leaves the server.** No credential field on any response schema; logs redact
   secrets. _Enforced by: `tests/guards/no-secret-in-response.test.ts`, which walks every response
   schema in `packages/shared/src/api.ts` (`*Request` schemas carry secrets inbound and are
   exempt). Tokens are stored AES-256-GCM-encrypted (`apps/api/src/crypto.ts`)._
3. **The model runtime is reached only through `packages/runtime`.** _Enforced by: the
   `no-restricted-imports` rule in `eslint.config.js` (`@anthropic-ai/*` is allowed only in
   `packages/runtime` and the parked `packages/provider-agents`)._
4. **English only, and never an em dash**, in every tracked text file: code, comments, prompts,
   UI copy, docs, commit messages and PR descriptions. Use a plain hyphen or restructure the
   sentence. _Enforced by: `tests/guards/prose.test.ts`, whose `ALLOWED` map names every file
   exempted and why. Vendored skills under `.claude/skills/` are exempt because they stay
   byte-identical to their verified upstream; their style never overrides this rule._

## 1. Product context

Clasp is an agent platform for B2C and B2B. A user builds an agent (system prompt, model,
response language, effort) and gives it **actions**: tools discovered from the MCP servers the
user connects. Clasp hosts the agent. Individuals work in a personal workspace; companies share an
organization workspace.

The marketplace (listing agents and earning from them) and monetization come later. **Do not build
marketplace, billing or payout features without asking.** Keep the seams that make them possible:
immutable agent versions, the `agent_runs` usage ledger, and the reserved `listed` visibility.

The original escrow prototype (packages `escrow-mcp-server`, `verifier`, `provider-agents`,
`contracts/escrow`, `db/escrow`) is **parked**: keep it green, add no features without asking.

## 2. Platform invariants

Rows whose check names a later milestone are conventions until that check exists.

| #   | Invariant                                                                                  | Enforced by                                                         |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| I1  | The Clasp database is the source of truth; the runtime only holds what `runtime_ref` names | `apps/api/src/agents/agents.test.ts` (runtime down, then sync)      |
| I2  | `agent_versions` rows are immutable; a configuration edit creates a new version            | trigger in `apps/api/drizzle/0002_*` + its test in `agents.test.ts` |
| I3  | One writer per aggregate: `AgentService`, `McpConnectionService`                           | `REPOSITORY` pattern in `eslint.config.js`                          |
| I4  | Routes hold no business logic and never import `db/`                                       | `DB` pattern in `eslint.config.js`                                  |
| I5  | Every run writes an `agent_runs` row with its usage                                        | Integration test (B4)                                               |
| I6  | `request.user` is set only in `apps/api/src/auth/current-user.ts` (login is deferred)      | `tests/guards/auth-seam.test.ts`                                    |

## 3. Layering

```
apps/web            -> packages/shared
apps/api routes     -> services
services            -> repositories, packages/runtime, packages/shared
repositories        -> db
packages/runtime    -> packages/shared
packages/shared     -> (nothing internal)
```

`eslint.config.js` enforces the API arrows (the `REPOSITORY` and `DB` patterns) and keeps
`apps/web` from importing API internals (`API_INTERNALS`).

## 4. Layout and commands

See [README.md](README.md) for the layout. Commands, all from the repository root:

| Command                             | What it does                                              |
| ----------------------------------- | --------------------------------------------------------- |
| `pnpm test`                         | guard tests, then every package's tests                   |
| `pnpm lint` / `pnpm typecheck`      | ESLint over the repo / `tsc --noEmit` in every package    |
| `pnpm format` / `pnpm format:check` | Prettier                                                  |
| `pnpm build`                        | build every package                                       |
| `pnpm --filter <package> <script>`  | run one package's script                                  |
| `cd contracts/escrow && forge test` | contract tests (needs Foundry and initialised submodules) |

CI (`.github/workflows/ci.yml`) runs all of the above plus a gitleaks secret scan.

## 5. TypeScript and data

- Strict TypeScript from `tsconfig.base.json`; every package extends it.
- Workspace packages export their sources under the `@clasp/source` condition, so dev, tests and
  typecheck read `src/` while `node dist/` reads the build. Add the condition to any new package.
- Validate with zod at every boundary. Shared schemas live in `packages/shared`; the escrow
  `JobSpec` schema lives in `packages/verifier` and nowhere else.
- Database changes go through `drizzle-kit generate`. Never edit an applied migration.

## 6. Runtime and models

- Load the `claude-api` skill (its Managed Agents docs) before touching `packages/runtime`. Never
  guess SDK bindings.
- Model IDs come only from `packages/shared/src/models.ts`, provider-prefixed
  (`anthropic/claude-sonnet-5-5`).

## 7. Testing

- Vitest everywhere. API integration tests run against Postgres in testcontainers (needs Docker).
- Tests use the in-memory `FakeRuntime`; tests that call the real runtime run only when
  `ANTHROPIC_API_KEY` is set.
- UI flows get Playwright end-to-end tests.

## 8. Security

- Configuration comes from env, validated by zod at startup. `.env` is never committed.
- Credentials are encrypted at rest (AES-256-GCM) and synced to the runtime's vaults; the API
  returns `hasCredential`, never the value.
- Skills and plugins are added only after a verification report (source, license, every file
  read, red flags) and explicit approval. Vendored skills carry a `SOURCE.md`.

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

## 10. Conventions (not enforced)

- Comments explain why, not what.
- `.env.example` lists every key the code reads, with no values.
- Prefer one well-named function over a flag that switches between two behaviours.
- Commits follow Conventional Commits; one PR per milestone; CI green before merge.
