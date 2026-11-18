# Brief — Mover materials, lap 1: beams stop on moving parts

Task: beams stop on moving parts; parts take their material's fire and ice (owner, 2026-11-18) · Lap: temp_job_mover-materials · Harness: v0.45.0

Route (owner, D1): one world of bodies, in five laps (DECISIONS.md § Lap cut). This brief is lap 1.

## Problem

The torch's flame and the freeze ray pass through moving parts: the shared ray fan reads only the static grid's samples, while rockets, blobs and goo use the arena's solid queries, which see parts.

## Success check

With a moving part between a spraying blob and a rival, for the torch and for the freeze ray: no ray of the fan ends past the part's surface, the rival behind the part is not lit, chilled or pushed, and the part's field is unchanged (nothing lit, nothing frozen). A fan with no part in its way gives the same hits as before.

## In scope

- The ray fan marches against a list of sample fields (the static terrain first, then each part in its pose) and reports which field a ray stopped on.
- The arena hands out that list (`terrainBodies`): the first piece of the body list lap 2 builds on.
- The torch and the freeze ray pass the list in and drop hits that are not on the static terrain (parts stay inert this lap).
- The drawn flame and breath end where the rays end (they already follow the rays' ends).

## Out of scope

- Will NOT do: fire, ice, craters or stains on parts (laps 2–5); W13 and the level prompt stay as they are until lap 2.
- Will NOT do: any change to what beam clash decides (PR #75); this lap starts editing `rayFan.ts` only after #75 is merged.
- Will NOT touch: `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `shared/utils/rayFan` | `castRayFan({ field })` reads one grid's `cells` | `fields: RayField[]` (a `SampleField` plus an optional world-to-local map); `RayHit.body` | ride (after #75) |
| `arena` | `moverDistanceAt` maps a world point into a part's rest pose with a reach broadphase | `terrainBodies(grid)` → the static field and one entry per part, exported from `arenaApi` | ride |
| `fire` (`torch.ts`) | lights or thaws `hit.sample` on the static grid | passes `terrainBodies`, skips hits with `body !== 0` | ride |
| `ice` (`freezeRay.ts`) | feeds cold from `hit.sample` on the static grid | same | ride |
| `combat` (`attacks.ts`), `shared/utils/beamClash` | the beam clash (PR #75) casts its own fans against the static grid | passes `terrainBodies`, so beams do not clash through a part | ride (found when #75 landed; still S) |
| `documentation` | arena, fire, ice, combat READMEs | one line each: rays stop on parts | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S.

## Plan

Conflict & compliance: `shared/utils` may not import a feature, so the fan cannot call the arena; the arena builds the list and the weapon passes it in (same direction as today's `field: terrain`). No new files outside existing folders; no new dependency; no state, so replays are unchanged. Naming (code-style F1): `RayField`, `terrainBodies` name roles, not the torch. Performance: a fan is at most 7 × 42 or 3 × 90 steps; each step adds one squared-distance reach check per part (16 at most) and a local lookup only inside a part's reach.

Built after #75 merged (main 732c13b). #75 cuts a fan by its `length`, outside the march, so the two changes met without overlap; its clash rule casts its own fans, so it takes the same list (edge added above).

1. **Acceptance test (red first).** In `src/features/fire/services/torch.test.ts` and `src/features/ice/services/freezeRay` coverage (`frozenBlobs.test.ts` holds the ray's blob tests): a level with one part between the holder and a rival; assert the success check. Add a `rayFan` unit test beside the util: a ray stops on a field given through a world-to-local map, and reports its `body`.
2. **Ray fan.** Rebase on main with #75 in it. `RayFanCast.field` becomes `fields: readonly RayField[]` (`{ field: SampleField; toLocal?: (p: Vec2) => Vec2 | null }`, `null` = outside the body's reach); `solidAt` tries each in order; `RayHit` gains `body` (index into `fields`). Keep #75's cap as it lands.
3. **Arena.** `terrainBodies(grid)`: `[{ field: grid }, ...grid.movers.map(...)]`, the part entry mapping through `unposePoint` and the part's `origin`, returning `null` beyond `reach`. Export from `arenaApi`.
4. **Weapons.** `sprayTorch` and `sprayFreezeRay` pass `terrainBodies(terrain)`; samples are taken only from hits with `body === 0`.
5. **Docs.** arena, fire and ice READMEs; this lap's decisions folded in.

Gate (once, at the end): `pnpm type-check`, `pnpm lint`, `pnpm arch:check`, the three touched test files, `pnpm validate:structure`.

Not verified by tests: the look of a flame ending on a moving part; the owner judges it on the preview with the crusher test level.

## Decisions

DECISIONS.md: D1–D4 closed.
