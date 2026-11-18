# Brief — Mover materials, lap 2a: fire on moving parts

Task: moving parts take their material's fire (owner, 2026-11-18; route: `temp_job_mover-materials/DECISIONS.md` D1–D3) · Lap: temp_job_mover-materials-l2 · Harness: v0.45.0

## Problem

A cardboard moving part acts like stone: the torch's flame ends on it (lap 1) and nothing happens. Fire's ground state exists once, sized to the static grid, so fire cannot live on a part's own field.

## Success check

The torch held on a cardboard part lights the sample it touches; the fire spreads through the part at the same speed as through cardboard ground and never leaves the part; a blob touching the burning part catches fire; a stone part never lights. After the burn time the burnt samples are gone from the part's field, so a body no longer collides with them (D1 of this lap, owner). Fire on static terrain behaves exactly as before (its tests pass unchanged in meaning).

## In scope

- Fire's ground state per body: one entry per field of the arena's body list (static terrain first, then each part).
- The torch lights and thaws the body it hits; fire spreads, is doused by freezing, and burns out per body.
- Blobs catch from a burning part.
- The fire layers per body: a part's fire is drawn in the part's own frame and follows its pose.
- Burn-out on a part cuts its field; the part's outline and fill follow (D1).
- Level format § 11, W13 text and the level prompt's moving-parts line: a part of a burning material burns (D2 of the route).
- GAME_JUICE ledger: fire on a part reuses fire's moments (no new look or sound).

## Out of scope

- Will NOT do: cold on parts — freeze ray, grip per sample, frozen overlay (lap 2b).
- Will NOT do: reactions as data (lap 3), craters on parts (lap 4), fire crossing between a part and the ground (lap 5).
- Will NOT touch: the player controller and roll (double-jump-bash thread); `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `fire` | `FireState` holds one ground state; `stepFire`, `ignite`, renderer, blob catch read the static grid | `FireState.grounds[body]`; functions take the body | ride (refactor + extension) |
| `arena` | `terrainBodies` (rays); `burnOut(grid, …)` works on any grid; part drawn from its pieces, ink from its field | part fill clipped by its field's contour and ink redrawn when the field changes; a `bodyGrids` list for state | ride |
| `match` | `stepFireOnTerrain` reports one batch; `matchSound` counts `fire.lit` | reads the per-body state through fire's API | ride |
| `level-file`, `level-kit`, `documentation/game` | W13 message, prompt line, § 11 say parts never burn | text change only | ride |
| `knockout` | its own pose-following stain layer | uses the arena's shared pose layer (code-style F2: third use, plan review A1) | ride (reference update) |
| `combat` (`explosions.ts`) | `reportTerrainDestroyed` takes `ClearedCells` | takes only `byLook`, so a batch merged over bodies fits | ride (type only) |
| `shared/utils/levelMotion` | `posePoint` | used to place a part's debris and smoke in the world | ride (no change) |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

M (fire sim, renderer and tests change shape; one arena drawing change; text changes).

## Decisions

DECISIONS.md: D1–D4 closed (D1 by the owner: a burnt part is gone for the round).
