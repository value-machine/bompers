# Brief — Game juice design system

Task: Game juice design system (owner feedback round 2 § 4.2) · Lap: temp_job_game-juice-system · Harness: v0.45.0

## Problem
New game elements keep arriving, and each lap picks its own shake, flash, squash, timing and sound loudness, so the game's feel drifts; there is no shared scale or checklist.

## Success check
`src/shared/config/gameJuice.ts` defines impact tiers, timing windows and the squash area band; the `feel` tunables read their tier values from it with unchanged numbers; a conformance test fails when any `feel` or `player.squash` value leaves its tier / window / band; `documentation/game/GAME_JUICE.md` lists every current game moment with its tier and channels; a path-scoped rule plus a `spec-apply-game-juice` skill make a lap touching game-element code apply it.

## In scope
- Code SSOT `src/shared/config/gameJuice.ts`: `JUICE_TIERS` (light / medium / heavy: shake px, flash alpha, hit-stop, music duck), `JUICE_SHAKE_CAP_PX`, `JUICE_WINDOWS` (seconds per role: flash, fade, shake, squash, effect, linger), `JUICE_SQUASH` (area band, axis range).
- `gameTunables.ts` `feel` section reads tier values from it (identical numbers).
- `gameJuice.test.ts`: conformance of `feel` + `player.squash` against tiers / windows / band.
- `documentation/game/GAME_JUICE.md`: the guideline — principles, tiers, channels per moment (ledger of all current moments), timing windows, squash, sound (links DESIGN_LANGUAGE § 8), new-element checklist. DESIGN_LANGUAGE § 6 / § 8 point to it.
- Agent guidance (protected, consent first): `.agents/skills/spec-apply-game-juice/SKILL.md` + catalog row; `.claude/rules/game-juice.md` path-scoped pointer; AGENTS.md rule catalog row.

## Out of scope
- Will NOT do: retune any value; move constants out of the files parallel threads own (`blobPose.ts`, `playerRenderer.ts`, `playerController.ts`, `soundBank.ts`, `soundPlayer.ts`, `effectsRenderer.ts`) — the guideline cites them where they live.
- Will NOT touch: `player` / `sound` / `effects` / `camera` feature code; `app-tasks.json`.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `src/shared/config` | `DEFAULT_GAME_TUNABLES.feel` holds literal shake / flash / hit-stop values | `gameJuice.ts` beside it; `feel` references tiers | new file + ride |
| `documentation/game` | DESIGN_LANGUAGE § 6 motion, § 8 audio | `GAME_JUICE.md` subcategory doc | new |
| `.agents/skills`, router catalog | no juice guidance | `spec-apply-game-juice` | new (protected) |
| `.claude/rules`, `AGENTS.md`, `DOC_RULES_INDEX.md` | no game rule | `game-juice.md` path-scoped + catalog / index rows | new (protected) |
| `loop-plan`, `loop-check` skills | no juice call | one Calls entry each (validator: spec skill needs ≥ 2 loop callers) | ride (protected, consent D6) |
| `ARCHITECTURE.md` | `shared/config` table | one `gameJuice.ts` row | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — one new config module + test, one-line refs in `feel`, docs, one skill + one rule.
Cut into laps: none.

## Decisions
DECISIONS.md D1–D4.
