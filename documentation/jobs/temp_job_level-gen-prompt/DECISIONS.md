# Decisions — level-gen-prompt

Job: `temp_job_level-gen-prompt`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Reading of "alleen de variabele settings hierin" | closed | A: one-click copy of the full prompt (sections 1–6 + empty section 7); every game-dependent number filled in live from code | owner via orchestrator | B (short block + hosted spec) and C (fill-in form) rejected |
| D2 | Where the prompt is built | closed | One pure `buildLevelPrompt()` in `level-file/services`; the app button calls it directly (no fetch), and the kit sync writes the same text to `public/level-kit/v2/LEVEL_PROMPT.md` | loop-refine (clear winner) | one source; drift-checked; hosted copy for people outside the app |
| D3 | Clipboard | closed | `navigator.clipboard.writeText` in a small feature hook; no package | loop-plan (clear winner) | no new dependency |
| D4 | Section 7 | closed | Heading + short instruction "describe your map here", left for the user | loop-refine (clear winner) | matches owner example structure |
| D6 | Feature home | closed | New `level-kit` feature (prompt, kit export, copy button); lobby renders the button in the "Your level" row | loop-build (architecture rule) | the prompt pushed `level-file/services` to 12 files (budget 10); split by concept instead of a budget waiver. `level-file` exports `MIN_SPAWNS` / `RECOMMENDED_SPAWNS` |
| D5 | Kit origin in the prompt | closed | `https://bompers.tom-fab.workers.dev` (level-file-format D14) | loop-plan (clear winner) | generated file must be deterministic, so not `location.origin` |

## Log

- 2026-11-16 — D1 closed via orchestrator (asked)
- 2026-11-16 — D2, D4 closed via loop-refine (clear-winner); D3, D5 via loop-plan (clear-winner)
