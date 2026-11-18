# Brief — Mover materials, lap 2b: cold on moving parts

Task: moving parts take the freeze ray's cold (owner, 2026-11-18; route: `temp_job_mover-materials/DECISIONS.md` D1–D3, cut in `temp_job_mover-materials-l2/DECISIONS.md` D2) · Lap: temp_job_mover-materials-l2b · Harness: v0.45.0

## Problem

The freeze ray's beam ends on a moving part (lap 1) and nothing happens: the ice state exists once, sized to the static grid, and a part has one grip number for the whole part.

## Success check

The freeze ray held on a part freezes the part's samples around where it touches, the same amount of ice per second as on the ground, and nothing on the ground behind it. The frozen patch is slippery where it is frozen and not beside it, wherever the part is in its motion; it thaws by itself after `ice.frozenSeconds`; the torch thaws it; fire cannot enter it and freezing a burning part sample puts it out. Frozen ground on static terrain behaves as before.

## In scope

- The thaw queue per body (`IceState.grounds`), one feed per ray and body; the freeze ray feeds the body each ray touches.
- Grip per sample on a part (the arena reads the part's samples under the feet).
- Frost layers per body, following the part's pose.
- Sound: thaw and freeze counts over all bodies.
- LEVEL_FORMAT § 11 sentence, GAME_JUICE row, READMEs.

## Out of scope

- Will NOT do: reactions as data (lap 3), craters on parts (lap 4), cold or fire crossing between bodies (lap 5).
- Will NOT do: any change to frozen blobs, the ray's look or sounds, the level prompt (nothing new an author can place or set).
- Will NOT touch: the player controller and roll; `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `ice` | one thaw queue and feed per slot on the static grid; one frost layer set | `grounds[body]`, feed per ray and body, frost view per body | ride |
| `arena` | `groundFrictionBelow` returns one number per part; `frozenVersion` per grid | per-sample grip in the part's frame; `frozenVersionOf` | ride |
| `fire` | the torch already thaws the body it touches (lap 2a) | test only | ride |
| `match` | sound reads `ice.frozenHead` and the static `frozenVersion` | `thawedCount`, `frozenVersionOf` | ride |
| `documentation/game` | § 11, juice ledger | one sentence, one row | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S–M, built as S: the body list, the pose layer and the per-body pattern come from lap 2a.

## Plan

Conflict & compliance: architecture (ice → arena api only; no new feature imports), code-style F2 (pose layer and body list reused, no new copy; the part-frame mapping inside the arena is one helper for rays and grip), game-juice (reuse of the owner-picked frost look and ice cues; ledger row), level prompt rule (untouched: nothing new to place or set). File budgets: ice services 9 → 10 with `iceRenderer.test.ts`; arena unchanged.

1. `ice.types.ts` / `iceSim.ts`: `GroundIce` per body; `feedCold` takes `body` and `share`; `stepIce` thaws every body; `thawedCount`.
2. `freezeRay.ts`: group the rays' samples by body and feed each with its share.
3. `arena`: `partFrictionBelow` (samples of the part under the span, frozen → ice grip), `frozenVersionOf`; remove `MoverBody.friction`.
4. `iceRenderer.ts`: a frost view per body in the arena's pose layer.
5. Tests: cold on a part (amount, nothing on the ground, thaw, grip where frozen and where the part is, fire interplay), torch thaws a frozen part, frost layer follows the pose; the lap 1 test that asserted "no cold on parts" now asserts the part froze.
6. Docs.

Gate: type-check, lint, arch:check, validate:structure, validate:feature-size, full test run.

## Decisions

- D1 (closed, loop-plan, clear winner): one feed per ray and body. A single feed per ray would need its distances on two grids at once; a new patch when the beam moves onto a part matches "the ice grows where the beam points" (ice-element D8).
- D2 (closed, loop-plan, clear winner): a fan split over bodies splits this step's ice by the rays on each body, so "the same amount of ice per second" (ice-element D3) holds.
- D3 (closed, loop-plan): the thaw sound's count is a counter that only goes up (`GroundIce.thawed`) instead of the queue head, which jumped back when the queue was compacted.
- D4 (closed, loop-plan): `MoverBody.friction` removed; grip comes from the part's samples, so an ice part and a frozen patch use one rule.
- Carried: on a turning part the frost turns with the part (as fire, lap 2a D4).
