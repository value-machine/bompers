# Brief — Stains as a terrain state

Task: owner request 2026-11-18 (via the orchestrator; not an app-tasks.json row) · Lap: temp_job_terrain-stains · Harness: v0.45.0

## Problem

Goo splats are shapes laid on top of the terrain at the touch point: they ignore the object's shape (float on slopes, hang past edges), fire and ice. The owner wants the goo to stain the object itself, with the system fire and ice use.

## Success check

A landing's stained samples are solid, lie in a thin coat under the surface within the stain's reach, shrink as it dries, and are drawn by the terrain's contour on the arena and on a moving part's own field.

## In scope

- Stain shape rule (`stainShape.ts`): reach, depth, wall run, drying, stage.
- Stains drawn with `markedRegion` + `terrainContour` per field and player colour, in a layer right above the terrain; moving parts in a layer that follows the part.
- Droplets that land on a moving part ride it.
- The sprite splats (floor lens, wall smear and streak, ceiling drips) removed.

## Out of scope

- Will NOT do: stains that stay for the round, per-sample stain storage on the terrain grid — excluded (D2).
- Will NOT touch: droplets in flight, loose helmet and tube, the crush pancake, timings (`respawnDelaySeconds`, `splatSeconds`).
- Will NOT touch: fire and ice code (layer order alone gives D3).

## Edges

| Feature area                        | Loop today                                                  | Hook point                                                                                   | Ride / new |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- |
| knockout                            | droplet contact / crush → `GooSplat` → one sprite per splat | `stainShape.ts` (was `splatShape.ts`), `knockoutRenderer.ts`, `knockoutSim.ts` `stepDroplet` | ride       |
| arena                               | `markedRegion`, `terrainContour`, `moverDistanceAt`         | `terrainSurfaces.ts` (region's working memory sized to its box)                              | ride       |
| match                               | `gameRenderer.ts` layer order, knockout frame               | adds `knockouts.stainLayer` above the terrain, passes `terrain`                              | ride       |
| documentation/game, ARCHITECTURE.md | splat wording                                               | DESIGN_LANGUAGE § Elimination, GAME_JUICE                                                    | ride       |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — one feature's look replaced on an existing mechanism (estimated M before D2 removed the stored state).
Cut into laps: none.

## Plan

1. `stainShape.ts` with tests first (samples in the coat, run, drying, stage).
2. Renderer: stain layer, per field and colour graphics, redraw key, part layers; renderer test.
3. Sim: droplets on a moving part ride it; test.
4. Match wiring, docs.

## Decisions

DECISIONS.md D1–D5.
