# Brief — Path-scope src-only guidance into its own rule

Task: Path-scope src-only guidance into its own rule · Lap: temp_job_path-scope-src-rule · Harness: v0.44.0

## Problem
Always-on rules carry guidance that only matters when editing `src/**` (code placement, edge-case placement, TypeScript, styling scope, API troubleshooting, pagination), so every non-src session (harness, docs, CI) pays ~1.7k tokens for it (context-cost audit R10, `documentation/jobs/harness/2026-11-03-CONTEXT_COST_AUDIT.md`).

## Success check
`.claude/rules/app-code.md` exists with `paths: ["src/**"]`, its Cursor mirror has `globs: ["src/**"]` and `alwaysApply: false`, the moved sections no longer appear in any always-on rule, every pointer to them resolves to the new file, and `node scripts/sync-agent-config.mjs --check`, `pnpm validate:skills` and the markdown link check pass.

## In scope
- New rule `app-code.md` with the moved sections, verbatim (no rule weakened).
- Pointer lines in `architecture.md`, `code-style.md`, `debugging.md`, `file-placement.md`, `spec-optimize-performance/references/optimization-levels.md`.
- `AGENTS.md` catalog (new row, debugging description), `documentation/DOC_RULES_INDEX.md` (section + matrix).

## Out of scope
- Will NOT move: architecture § Folder structure (task: keep folder meanings), § Feature granularity (plan-time obligation before any src file is read), code-style § Naming / § Complexity / § Reuse (apply to `scripts/` too; complexity referenced by skills), TanStack Query summary.
- Will NOT touch: `src/**`, `app-tasks.json`, `.claude/settings.json`.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `.claude/rules/` | always-on rules load every session | new `paths:` rule | new — one rule file |
| Cursor mirror | `sync-agent-config.mjs` maps `paths:` → `globs` | generated `.cursor/rules/app-code.mdc` | ride |
| Skills | `spec-optimize-performance` cites architecture § Code placement | pointer line | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — one new rule, five pointer edits, two docs.
Cut into laps: none

## Decisions
- D1 name `app-code.md` (role: app source standards), clear-winner over `src-code.md` (location-named, F1).
- D2 keep Feature granularity and Complexity always-on, clear-winner: both apply before or outside `src/**` reads.
- Protected-file consent: orchestrator (game-orchestration D4).
