# Source

- Upstream: https://github.com/Leonxlnx/taste-skill, skills/minimalist-skill/SKILL.md
- Commit: f6831c5df8ad546c2567535442f1691a823868e3 (2026-10-19). Upstream removed the skill in
  825e306, so it receives no further updates.
- License: MIT (repository LICENSE, copied into this folder)
- Verified: 2026-11-12, every file read
- Verdict: approved with notes. It is opt-in (disable-model-invocation: true) and runs only when
  called by name. It bans Lucide icons and the Inter font, which are this project's shadcn
  defaults, and contradicts frontend-design on labels and palette: when invoked, follow the
  project's design system where they conflict. Uses picsum.photos placeholder images.
