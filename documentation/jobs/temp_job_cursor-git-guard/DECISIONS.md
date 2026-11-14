# Decisions — temp_job_cursor-git-guard

Job: `temp_job_cursor-git-guard`
Updated: 2026-11-14

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | One script for both tools | closed | extend `deny-git-write-on-main.cjs`, detect `cursor_version` | loop-refine | clear winner, same as cursor-feedback-hooks D2 (code-style F2) |
| D2 | Cursor deny shape | closed | exit 0 + `{"permission":"deny", user_message, agent_message}` | loop-refine | documented JSON contract; exit 2 also denies but carries no message |
| D3 | Cursor allow shape | closed | exit 0 + `{"permission":"allow"}` | loop-refine | docs: on permission hooks, invalid/no JSON may block; the docs' own block-git example answers allow. Hook `matcher: "git"` keeps unrelated commands out of the hook entirely |
| D4 | Crash behaviour | closed | Cursor: catch → `allow`; `failClosed: false` covers crashes outside the catch. Claude Code: unchanged (uncaught → non-zero non-blocking) | loop-refine | brief requirement; Claude Code path kept byte-identical |
| D5 | Cursor cwd | closed | `cwd`, else `workspace_roots[0]` via shared `resolveCwd` (moved from type-check-on-stop to hook-input) | loop-plan | second consumer → shared helper |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log
- 2026-11-14 loop-check: `pnpm test:classify` 168/168, eslint 0 errors on touched scripts, `validate:structure`, `validate:docs` green; stdin end-to-end on Cursor and Claude Code input (deny JSON / allow JSON / exit 2). Not verified: a live Cursor session (owner check on the PR).
