# Source

- Upstream: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
- Commit: 1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62
- License: MIT, declared in SKILL.md frontmatter and the upstream README (the upstream repository
  has no LICENSE file)
- Verified: 2026-11-12, SKILL.md and README read in full; rule files scanned for network, exec and
  injection markers
- Verdict: approved with notes. Clasp's web app is a Vite SPA with a Fastify API, so the
  Next.js-specific rules (server-*, Server Actions, after(), RSC serialization) do not apply.
- Vendored content is not edited here; update by re-copying from a new verified commit.
