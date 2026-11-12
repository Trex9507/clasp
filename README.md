# Clasp

Clasp is an agent platform. Anyone, an individual or a company, builds agents for their own work,
and Clasp hosts them. Later, creators will be able to list an agent on the Clasp marketplace and
earn from it.

The repository also holds the original Clasp prototype: escrow for paid work between agents
(USDC, a Solidity contract and an MCP server). It is kept and tested, but parked.

## What you can do

- **Build agents.** Give an agent a name, a system prompt, a response language, a Claude model
  and an effort level. Every configuration change is saved as a new, immutable version.
- **Connect MCP servers.** Add a server by URL, with no auth or a bearer token; Clasp discovers
  its tools.
- **Give agents actions.** Pick which of those tools an agent may use, and for each one choose
  "Ask me first" or "Run automatically" and add an optional usage note.
- **Try agents in the Playground.** Chat with an agent, watch its actions stream in, approve or
  deny them, and see each run's tokens and cost against its spending cap.
- **Work in workspaces.** A personal workspace for individuals, organization workspaces for teams.

Agents are hosted on Claude Managed Agents. Without an Anthropic API key the platform runs on a
built-in simulated runtime, so every screen works locally with placeholder replies.

## Layout

```
apps/
  web/                 platform UI (React, Vite, shadcn)
  api/                 control-plane API (Fastify, Drizzle, Postgres)
packages/
  shared/              API contracts, model catalog and languages shared by web and api
  runtime/             the AgentRuntime adapter: Claude Managed Agents, plus a simulated runtime
  evals/               model evals of agent behavior (Braintrust Eval, regression baselines)
  escrow-mcp-server/   parked: MCP server for the escrow prototype
  verifier/            parked: acceptance-criteria verifier, owns the JobSpec schema
  provider-agents/     parked: provider agents for the escrow prototype
contracts/escrow/      parked: ClaspEscrow Solidity contract (Foundry)
db/escrow/             parked: SQLite schema and seed for the escrow prototype
docs/                  architecture and business model, escrow prototype, simulation
tests/guards/          repository-wide guard tests (see CLAUDE.md)
```

## Getting started

Prerequisites: Node 22.13 or later, pnpm 11 (`corepack enable`), Docker (for Postgres and the API
tests), and Foundry for the contracts.

```bash
pnpm install
cp .env.example .env
pnpm test          # guard tests, then every package's tests (Docker must be running)
pnpm lint
pnpm typecheck
pnpm build
```

### Run the platform locally

```bash
docker compose up -d postgres            # Postgres on localhost:5433
pnpm --filter @clasp/api db:migrate
pnpm --filter @clasp/api db:seed         # dev@clasp.local and a personal workspace
pnpm --filter @clasp/api dev             # API on http://localhost:3001
pnpm --filter @clasp/web dev             # web app on http://localhost:5173
```

Open http://localhost:5173. Login is deferred: every request runs as the seeded development user.

### Configuration

Every key is listed in [.env.example](.env.example). The ones that change what you can do:

| Key                         | What it does                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | Hosts agents on Claude Managed Agents. Unset: the simulated runtime.                                     |
| `CREDENTIAL_ENCRYPTION_KEY` | Encrypts MCP bearer tokens (`openssl rand -base64 32`). Unset: connections with a token cannot be saved. |
| `RUN_BUDGET_CENTS`          | Spending cap of each Playground run, in US cents (default 100 = $1.00).                                  |
| `MCP_ALLOW_PRIVATE_HOSTS`   | Lets MCP discovery reach localhost and private networks (default: allowed outside production).           |

Hosted agents run in Anthropic's cloud, so with a real API key their MCP servers must be reachable
from the internet; a server on `localhost` only works with the simulated runtime.

### Evals

Evals measure how hosted agents behave (tool use, prompt-injection resistance, response
language) and gate pull requests that could change it. They call Claude, so they need
`ANTHROPIC_API_KEY` and stop at a budget (default $2 per run):

```bash
pnpm --filter @clasp/evals eval
```

See [docs/evals.md](docs/evals.md) for the method, the suites and every case.

### Contracts

```bash
git submodule update --init --recursive
cd contracts/escrow && forge build && forge test
```

## Contributing

- Branch names start with `feature/`, `chore/` or `fix/`; commits follow Conventional Commits.
- CI runs format, lint, typecheck, test and build, the contract tests and a secret scan.
- [CLAUDE.md](CLAUDE.md) holds the engineering rules and the check that enforces each one.

## Documentation

- [CLAUDE.md](CLAUDE.md): engineering rules and how each one is enforced.
- [docs/evals.md](docs/evals.md): how agent behavior is evaluated, and every eval case.
- [docs/architecture.md](docs/architecture.md): the escrow model, economics and risks.
- [docs/escrow-prototype.md](docs/escrow-prototype.md): how to run the parked escrow prototype.
- [docs/simulation/results.md](docs/simulation/results.md): the market simulation behind the fee and stake choices.
