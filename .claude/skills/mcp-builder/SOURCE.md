# Source

- Upstream: https://github.com/anthropics/skills/tree/main/skills/mcp-builder
- Commit: 2c5958ecac7cee2b583967a2c4981d0f4a75c579
- License: Apache-2.0 (LICENSE.txt in this folder)
- Verified: 2026-11-12, every file read
- Verdict: approved with notes. The eval scripts in scripts/ are Python, depend on unpinned
  anthropic and mcp packages, and use ANTHROPIC_API_KEY; run them only deliberately. The skill
  fetches SDK READMEs from upstream main at runtime and suggests unpinned npx tools: pin versions
  when following it. Overlaps the mcp-server-dev plugin.
- Vendored content is not edited here; update by re-copying from a new verified commit.
