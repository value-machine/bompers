# Brief — Port feedback hooks to Cursor

Task: Port feedback hooks to Cursor · Lap: temp_job_cursor-feedback-hooks · Harness: v0.44.0

## Problem
Claude Code sessions get edit-time lint and stop-time type-check feedback (`.claude/settings.json` hooks); Cursor sessions get none and only learn at pre-commit or CI.

## Success check
`.cursor/hooks.json` runs `scripts/lint-edited-file.cjs` on `postToolUse` (Write) and `scripts/type-check-on-stop.cjs` on `stop`; fed Cursor-shaped input, the lint script returns `additional_context` (exit 0) and the stop script returns `followup_message` for a completed turn with type errors; Claude Code output is unchanged; gaps are documented.

## In scope
- `.cursor/hooks.json`; Cursor input/output in the two scripts + `hook-input.cjs`; tests; `DOC_AGENT_WORKFLOW_LAYERS.md` § Local git.

## Out of scope
- Will NOT do: port SessionStart dependency install or the deny-git-write-on-main guard (documented as gaps).
- Will NOT touch: `.claude/settings.json`, rules, skills, `src/`.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `scripts/` hook scripts | Claude Code JSON in/out | input detection + output formatter | ride |
| `.cursor/hooks.json` | Not found | new config | new — Cursor's documented hooks file |
| Docs | `DOC_AGENT_WORKFLOW_LAYERS` says "Cursor has no equivalent" | § Local git | ride |

## Size
S — one config, three scripts, two test files, one doc.
Cut into laps: none

## Decisions
- D1 `postToolUse` (matcher `Write`) over `afterFileEdit`, clear-winner: `afterFileEdit` has no output to the agent (cursor.com/docs/agent/hooks).
- D2 one script per hook for both tools, detecting `cursor_version`, clear-winner over Cursor-only copies (code-style § Naming F2).
- D3 stop follow-up only on `status: completed`, clear-winner: no follow-up after the owner aborts a turn.
- Source: https://cursor.com/docs/agent/hooks, read 2026-11-14.
