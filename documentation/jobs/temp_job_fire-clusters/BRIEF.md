# Brief — Fire clusters: merged flames that grow with their neighbours

Task: Fire clusters (orchestrator run, owner 2026-11-17) · Lap: temp_job_fire-clusters · Harness: v0.45.0

## Problem

Owner (2026-11-17): "Can we make the fire so that the more flames are next to each other, the bigger the flames are, and that a bunch of flames together don't have outlines in between them, only on the outside of that entire fire shape?" The terrain fire draws one tongue per 2 × 2 burning samples everywhere in the burning band; once a tongue shrinks with age its ink line shows between it and its neighbours, and every tongue has the same size whatever burns around it.

## Success check

A cluster of touching burning blocks yields one connected silhouette (body slabs under every burning block, flames only on its top edge), a flame with burning neighbours is taller than a lone one of the same age, and a 50 × 7 block fire yields fewer shapes than its block count (`flameShapes.test.ts`).

## In scope

- Terrain fire drawn per cluster: the burning blocks' body under one ink line, flames on the cluster's top edge only, flame size from the burning neighbours, hot amber inside near the front. Flame rule = the owner's pick from the options page (D1).
- Docs: fire README, DESIGN_LANGUAGE § 1 fire row, GAME_JUICE ledger row if the fire-spreading row names the look.

## Out of scope

- Will NOT touch: the fire sim (spread, burn time, burn-out batches), blob catching and damage — render only.
- Will NOT touch: torch spray, release puff, idle nozzle flame, burning-blob look, smoke puffs, scorch on earth.
- Will NOT touch: palette values; fire sounds (placeholders, fire-spread D8).
- Will NOT do: a per-frame marching-squares contour of a heat field (D2) — excluded on frame cost.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `fire` | `syncFireView` → `drawFlames`: `flameBlocks` → char circles → one `terrainTongue` per block in ink, ember, amber, core | `services/flameShapes.ts` (pure cluster geometry + tests), `services/fireRenderer.ts` (`drawFlames`) | ride — same layer and passes, new shapes |
| docs (`documentation/game`) | DESIGN_LANGUAGE § 1 fire row; GAME_JUICE fire rows | fire rows | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — one pure geometry addition with tests, one renderer function reworked, docs. `fire/services` is at its 10-file layer budget, so the cluster geometry goes into `flameShapes.ts`.
Cut into laps: none.

## Decisions

DECISIONS.md D1 (open: owner's pick), D2–D4.
