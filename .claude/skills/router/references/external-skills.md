# Skills outside this repo

User-level and plugin skills the loop may hand to. Read by [`../SKILL.md`](../SKILL.md) when a request belongs to a stack tool, not to a loop stage. Moved from `router` § Skill index (v0.42.0). In Claude Code, `~/.cursor/skills-cursor/*` isn't available: skip those rows.

### Claude Code built-ins

Skills that ship with Claude Code. Loop skills call them as **backing steps only**: each one runs inside a loop stage, and no loop gate, owner stop or repo rule is replaced by it. Cursor has no equivalent: skip these rows there. Context-cost audit R12.

| Built-in | Called from | Overlap |
|---|---|---|
| `/code-review` (correctness bugs on a diff) | `loop-check` step 2, as one of the size-M lenses | Backs the lens review; rule audits, tooling gates and plan compliance stay |
| `/simplify` (reuse / simplification cleanups, applies fixes) | `loop-build` step 7; `spec-optimize-performance` at the complexity level | Backs the cleanup pass; fixes stay inside the brief and re-pass the phase gates |
| `/loop` (re-run a prompt on an interval) | not called | No overlap with `loop-orchestrate`: it repeats one prompt, it doesn't run owner-gated laps |
| `/batch` (one mechanical change fanned out) | not called | No overlap with `loop-orchestrate`: it has no backlog, briefs, Stop 2 or merge-after-Pass |

### User-level Cursor skills (`~/.cursor/skills-cursor/`)

| Situation | Skill |
|-----------|--------|
| Author or refine a project skill under `.agents/skills/` | [`meta-write-skill`](../../meta-write-skill/SKILL.md) (this repo's SSOT; `~/.cursor/skills-cursor/create-skill` is reference-only here) |
| Migrate `.mdc` rules / slash commands → skills | `~/.cursor/skills-cursor/migrate-to-skills/SKILL.md` |
| Create `.claude/rules` `.mdc` guidance | `~/.cursor/skills-cursor/create-rule/SKILL.md` |
| Cursor hooks (`hooks.json`, hook scripts) | `~/.cursor/skills-cursor/create-hook/SKILL.md` |
| Custom subagents | `~/.cursor/skills-cursor/create-subagent/SKILL.md` |
| PR merge-ready loop (comments, conflicts, CI) | `~/.cursor/skills-cursor/babysit/SKILL.md` — used by `loop-ship` step 6 under Cursor |
| Split work into small PRs | `~/.cursor/skills-cursor/split-to-prs/SKILL.md` |
| Standalone analytical UI artifact (`.canvas.tsx`) | `~/.cursor/skills-cursor/canvas/SKILL.md` |
| IDE `settings.json` | `~/.cursor/skills-cursor/update-cursor-settings/SKILL.md` |
| CLI `~/.cursor/cli-config.json` | `~/.cursor/skills-cursor/update-cli-config/SKILL.md` |
| CLI status line | `~/.cursor/skills-cursor/statusline/SKILL.md` |
| User typed `/shell` — run remainder literally | `~/.cursor/skills-cursor/shell/SKILL.md` |

### Plugin skills (paths vary by install; discover under `~/.cursor/plugins/`)

| Situation | Skill (name) |
|-----------|----------------|
| Cloudflare platform routing (“what product do I use?”) | `cloudflare` |
| Wrangler CLI commands and config | `wrangler` |
| Workers code author/review, anti-patterns | `workers-best-practices` |
| Durable Objects design/review | `durable-objects` |
| Agents SDK reference-heavy agent work | `agents-sdk` |
| Generate/deploy AI agent app on Cloudflare | `building-ai-agent-on-cloudflare` |
| Remote MCP server on Workers | `building-mcp-server-on-cloudflare` |
| Untrusted code execution / sandbox | `sandbox-sdk` |
| Core Web Vitals / Lighthouse-style audit (Chrome DevTools MCP) | `web-perf` |
| Migrate Cursor config → Claude Code (rules, skills, MCP) while Cursor keeps working | `/cursor-migration:migrate` — plugin published from this repo (`plugins/cursor-migration/`, marketplace `plate-harness`; install steps in its `README.md`); cloud sessions run `node plugins/cursor-migration/scripts/*.mjs` directly |
