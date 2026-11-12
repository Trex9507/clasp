# Clasp

Clasp is an agent platform. Anyone, an individual or a company, builds agents for their own work:
a system prompt, a model, a response language, and actions that come from the MCP servers they
connect. Clasp hosts the agents. Later, creators will be able to list an agent on the Clasp
marketplace and earn from it.

The repository also holds the original Clasp prototype: escrow for paid work between agents
(USDC, a Solidity contract and an MCP server). It is kept and tested, but parked.

## Layout

```
apps/
  web/                 platform UI (React, Vite, shadcn)           [Part B]
  api/                 control-plane API (Fastify, Postgres)        [Part B]
packages/
  shared/              schemas shared by web and api                [Part B]
  runtime/             AgentRuntime adapter (Claude Managed Agents) [Part B]
  escrow-mcp-server/   parked: MCP server for the escrow prototype
  verifier/            parked: acceptance-criteria verifier, owns the JobSpec schema
  provider-agents/     parked: provider agents for the escrow prototype
contracts/escrow/      parked: ClaspEscrow Solidity contract (Foundry)
db/escrow/             parked: SQLite schema and seed for the escrow prototype
docs/                  architecture and business model, escrow prototype, simulation
tests/guards/          repository-wide guard tests (see CLAUDE.md)
```

## Getting started

Prerequisites: Node 22.13 or later, pnpm 11 (`corepack enable`), and Foundry for the contracts.

```bash
pnpm install
cp .env.example .env
pnpm test          # guard tests, then every package's tests
pnpm lint
pnpm typecheck
pnpm build
```

Contracts:

```bash
git submodule update --init --recursive
cd contracts/escrow && forge build && forge test
```

## Documentation

- [CLAUDE.md](CLAUDE.md): engineering rules and how each one is enforced.
- [docs/architecture.md](docs/architecture.md): the escrow model, economics and risks.
- [docs/escrow-prototype.md](docs/escrow-prototype.md): how to run the parked escrow prototype.
- [docs/simulation/results.md](docs/simulation/results.md): the market simulation behind the fee and stake choices.
