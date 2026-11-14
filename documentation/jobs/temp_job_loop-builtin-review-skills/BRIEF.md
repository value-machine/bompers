# Brief — Let loop skills call Claude Code built-in review skills

Task: Let loop skills call Claude Code built-in review skills · Lap: temp_job_loop-builtin-review-skills · Harness: v0.44.0

## Problem
Claude Code ships `/code-review`, `/simplify`, `/loop` and `/batch`; the loop skills neither use nor rule them out, so agents either duplicate their checks or wonder whether they replace loop stages (context-cost audit R12).

## Success check
`loop-check` (size-M lens), `loop-build` (step 7) and `spec-optimize-performance` (complexity level) name the built-in in their Calls line and step, each marked Claude Code only with a Cursor skip; `router/references/external-skills.md` records where each built-in is used and that `/loop` and `/batch` don't overlap `loop-orchestrate`; no gate is removed; `pnpm validate:skills` and the sync `--check` pass.

## In scope
- Calls lines + one step sentence in three skills; one table in `external-skills.md`.

## Out of scope
- Will NOT do: replace any lens, gate, rule audit or owner stop with a built-in.
- Will NOT touch: `loop-orchestrate`, rules, `src/`.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `loop-check` | size-M lens review via plan-review fan-out | step 2, agent-picked lens | ride |
| `loop-build` | step 7 Finish → loop-check | step 7 | ride |
| `spec-optimize-performance` | four-level analysis | Calls line | ride |
| `router/references/external-skills.md` | external skill index | new section | new — one table |

## Size
XS — four files, additive.
Cut into laps: none

## Decisions
- D1 built-ins back loop steps, never replace them, clear-winner (audit R12: loop skills carry owner gates and repo rules the built-ins lack).
- D2 the overlap verdict lives once in `external-skills.md`; skills link there, clear-winner (one home per fact).
- Protected-file consent: orchestrator (game-orchestration D4).
