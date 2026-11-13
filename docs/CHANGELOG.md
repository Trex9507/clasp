# Changelog

Dated history of changes, newest first. Entries are prepended, never edited to match later
state. Multiple changes on the same day share one dated heading. CI's `changelog entry` check
requires an entry for any change under `apps/`, `packages/`, `contracts/` or `db/`.

## 2026-11-13

- **CI follows Sentinel's structure.** One `CI` workflow with `check`
  (fmt-check / lint / types / guards / test / build), `ui` (web types, tests, and a build that
  fails when a chunk exceeds Vite's 500 kB limit), `contracts`, `changelog` and `secret-scan`,
  each with a comment on why it exists. This changelog starts here; earlier entries are written
  from the commit history.
- **Model evals with a CI regression gate** (`packages/evals`). Suites for action use,
  tool-output injection and response language, built on Braintrust's `Eval()`; code scorers
  first and a Claude Opus 5.5 judge only where code cannot check. Baselines with zero tolerance
  for guardrail scores and a per-run budget. The `evals` workflow runs on pull requests that
  touch agent behavior once the `ANTHROPIC_API_KEY` secret exists. See `docs/evals.md`.
- **Invariant I3 gained a real check.** `tests/guards/single-writer.test.ts` lets only the
  owning service import a repository's write functions; until then the claim rested on an
  ESLint pattern that only kept routes away from repositories.
- **The web bundle is split** per route (React Router `lazy`) and into named vendor chunks. The
  largest chunk went from 989 kB to 311 kB.
- **Playground (milestone B4).** Runs are runtime sessions pinned to the agent's hosted version,
  with a spending cap and an `agent_runs` usage ledger; events stream over SSE; "Ask me first"
  actions pause for approval. Starting a run re-hosts an agent the runtime lost, and runtime
  failures answer 502 with a readable detail.
- **MCP connections and agent actions (milestone B3).** Bearer tokens encrypted at rest and
  mirrored into the workspace vault; discovery refuses private addresses in production; actions
  carry a permission and a usage note and are part of the versioned agent config.
- **Agents (milestone B2).** Create, edit and archive agents; every configuration change is an
  immutable version, enforced by a database trigger. Hosted on Claude Managed Agents through the
  `AgentRuntime` adapter, with a simulated runtime when no API key is set.

## 2026-11-12

- **Platform foundation (milestone B1).** Fastify API on Postgres with workspaces, the deferred
  login seam and `{ detail }` errors; the web shell built from Sentinel's scaffold; guards for
  workspace scope, secrets in responses and the auth seam.
- **Claude Code setup.** Verified and approved plugins, vendored skills with `SOURCE.md`
  provenance, and the Playwright MCP server pinned to a version.
- **Monorepo restructure.** The legacy SecondHand UAE app was removed (recoverable from the
  `legacy-secondhand-uae` tag), the escrow prototype moved into a pnpm workspace and was
  translated to English, and its defects were fixed: the free revision could not be submitted,
  translation deliveries always failed verification, and the deploy script did not compile.
