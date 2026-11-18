# Brief — Burning and frozen ground keep the terrain's shape

Task: owner observation 2026-11-18 (via the orchestrator; not an app-tasks.json row) · Lap: temp_job_element-overlay-shape · Harness: v0.45.0

## Problem

A burning or frozen part of the terrain is drawn as its own rounded row pieces of 8-unit blocks, so it loses the base shape: it steps along curves, sticks out past the terrain's edge and swallows thin platforms.

## Success check

The contour of a set of marked samples follows the terrain's own edge (slab corner, crater rim to within half a unit) where the part reaches it, holds every marked sample and no unmarked solid one, and fire and ice draw their ground with it.

## In scope

- One mechanism in the arena: `terrainContour` limited to a `SampleRegion` (`markedRegion`, `breakableRegion`), `edgeAbove`, `TerrainGrid.shapeVersion`.
- Fire's body and hot inside, and frozen ground with its lip, drawn with it; flames rooted on the terrain's edge.
- The row-slab helper (`shared/utils/blockSlabs`) and its two callers' slab code removed.

## Out of scope

- Will NOT do: new flame or frost designs, sounds, tunables — excluded.
- Will NOT touch: what burns or freezes, spread, thaw, burn-out (sim) — stays unchanged.
- Will NOT touch: the flames' pooling and sizes (fire-clusters D1–D2), the freeze ray's breath.

## Edges

| Feature area       | Loop today                                                               | Hook point                                                       | Ride / new                                                                                            |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| arena              | `terrainContour` draws ink and the breakable clip (`breakableOnly` flag) | `terrainSurfaces.ts`, `terrainGrid.ts` `writeSample`, `arenaApi` | ride — the flag becomes a region; third consumer of "terrain limited to some samples" (code-style F2) |
| fire               | `clusterFlames` body + hot row slabs, drawn every frame                  | `fireRenderer.ts`, `flameShapes.ts`                              | ride                                                                                                  |
| ice                | `frozenShapes` body + lip row slabs                                      | `iceRenderer.ts`, `iceShapes.ts`                                 | ride                                                                                                  |
| shared/utils       | `blockSlabs.ts`                                                          | removed                                                          | ride                                                                                                  |
| documentation/game | DESIGN_LANGUAGE § 1 Effects rows for fire and frozen ground              | two rows                                                         | ride                                                                                                  |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — three feature areas, one shared mechanism, no sim change.
Cut into laps: none. Stacked on `claude/ice-element` (PR #63); rebase onto main when it lands.

## Plan

1. Arena: region option, `markedRegion`, `breakableRegion`, tests first (`terrainSurfaces.test.ts`).
2. Fire: body from the contour (ink, ember, hot inset), flames in their own layers, rooted on `edgeAbove`.
3. Ice: frost from the contour, lip as the same contour without its top sample row.
4. Remove `blockSlabs`, update READMEs and DESIGN_LANGUAGE.

## Decisions

DECISIONS.md D1–D5.
