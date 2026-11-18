# Brief — Ice element, lap 1: the freeze ray and frozen ground

Task: "What we've done for fire, I would now like to do for every element, one by one" — ice first (owner, 2026-11-18) · Lap: temp_job_ice-element · Harness: v0.45.0

## Problem
Fire is the only element. The owner wants ice next, built on the same system as fire, so a third element later costs little.

## Success check
A blob holding the freeze ray's fire freezes the ground the beam touches; the beam makes a fixed amount of ice per second (3600 units²), always on the nearest unfrozen ground to where it touches, for as long as it is held, and nothing grows when it is let go or anywhere the beam is not (D8, Change round). Frozen ground is slippery, a rocket leaves it whole, a spreading fire stops at it, and it thaws after 8 s. The torch thaws it at once and then lights it only if it is cardboard.

## In scope
- The spreading front shared by fire and ice, the ray fan shared by the torch and the freeze ray, and the row-run slabs shared by both renderers (all in shared utils). Fire keeps its behaviour; its tests are the guard.
- Frozen as a per-sample flag on the terrain grid, applied by the arena to grip, craters and fire.
- The ice feature: the cold front fed by the ray, the thaw timer, the freeze ray, the frozen-ground and beam layers.
- The crate item `freeze-ray`, its tube, accent, tunables, HUD pills, placeholder start sound; listed in the start arena's drops; level kit synced.

## Out of scope
- Will NOT do: frozen blobs and their counterplay (lap 2); ice sounds (lap 3, listening page); a look polish round (after the owner has played it).
- Will NOT do: frozen ground on moving parts (craters and fire don't touch them either).
- Will NOT touch: the player feature; `src/config/app-tasks.json`.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| ice | Not found | `features/ice/`: state, front, ray, renderer | new — one domain (frozen ground + the ray that makes it) |
| arena | `writeSample`, `clearCrater`, `groundFrictionBelow` | `frozen` flag on the grid | ride |
| fire | own heap front, own ray fan | uses the shared front and fan; stops at frozen, goes out when frozen, torch thaws | ride (refactor, behaviour kept) |
| combat | `sprayAttack` hook for the torch | hook carries the weapon id; `sprayStarted` event | ride |
| content-catalog, level-kit, level files | items and kit export | `freeze-ray` item, prompt line, start arena drops | ride |
| shared | weapon ids, tube, palette, tunables | new id, `emitter` tube, `ice` colours and tunables, `sampleFront`, `rayFan`, `blockSlabs` | ride |
| match | sim steps and layers | `GameState.ice`, step 3e, two layers | ride |
| sound | event → cue | `sprayStarted` by weapon | ride |
| docs | vision, DESIGN_LANGUAGE, GAME_JUICE | rows for ice | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — a new feature (sim + render), three extractions with fire as the second consumer, a grid flag, a weapon.
Cut into laps: lap 2 frozen blobs (M); lap 3 ice sounds on a listening page (S); lap 4 look polish, optional (S).

## Plan (short)
1. Shared: `sampleFront` from the heap front of fire, `rayFan` from the torch. Arena: `frozen` flag with its three effects. Fire onto both, tests unchanged.
2. Combat: hook carries `itemId`; `sprayStarted`.
3. Ice feature on both; match wiring; catalog, palette, tunables, level.
4. Tests: `iceSim.test.ts`, torch thaw, combat spray weapon id. Docs and ledger rows.

## Decisions
DECISIONS.md D1–D7.
