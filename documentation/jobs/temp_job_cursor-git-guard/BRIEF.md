# Brief — Port the no-git-writes-on-main guard to Cursor

Task: Port the no-git-writes-on-main guard to Cursor · Lap: temp_job_cursor-git-guard · Harness: v0.44.0

## Problem
Claude Code agents can't commit or push to `main` (PreToolUse guard); Cursor agents have no such guard.

## Success check
`.cursor/hooks.json` runs `scripts/deny-git-write-on-main.cjs` on `beforeShellExecution`; fed Cursor-shaped input it answers `{"permission":"deny", user_message, agent_message}` (exit 0) for a git write to `main`, `{"permission":"allow"}` for other git commands and on an internal crash; Claude Code input still gets exit 2 + stderr / exit 0 silent exactly as before.

## In scope
- `.cursor/hooks.json` entry; Cursor input/output in the guard script; shared `resolveCwd` in `hook-input.cjs`; tests; `DOC_AGENT_WORKFLOW_LAYERS.md` § Local git gaps.

## Out of scope
- Will NOT do: port the SessionStart dependency install; verify in a live Cursor session (owner check).
- Will NOT touch: `.claude/settings.json`, rules, skills, `src/`, `src/config/app-tasks.json`.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `scripts/deny-git-write-on-main.cjs` | Claude Code PreToolUse JSON → exit 2 / 0 | input reader + output formatter | ride |
| `scripts/hook-input.cjs` | parse, stdin, `isCursorInput` | + `resolveCwd` (moved from type-check-on-stop) | ride |
| `.cursor/hooks.json` | postToolUse + stop | + beforeShellExecution | ride |
| Docs | gap listed as "not ported" | § Local git Cursor port | ride |

## Size
S — one script + test, one shared helper move, one config entry, one doc paragraph.
Cut into laps: none

## Decisions
DECISIONS.md D1–D4. Source: https://cursor.com/docs/agent/hooks, read 2026-11-14.
