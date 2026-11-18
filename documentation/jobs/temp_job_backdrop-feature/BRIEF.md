# Brief — Move the backdrop out of the arena feature

Task: make room in `arena/services` (at its file budget of 10) for craters on moving parts, by a role-named move instead of a budget override (orchestrator, 2026-11-18) · Lap: temp_job_backdrop-feature · Harness: v0.45.0

## Problem

`arena` is the terrain runtime, but it also holds the backdrop renderer (sky, sun, hills, clouds), which reads nothing of the terrain. With it, `arena/services` is full, so mover-materials lap 4 cannot add the module it needs.

## Success check

`backdropRenderer.ts` lives in a `backdrop` feature with its own API and README; `arena/services` holds 9 files; the game draws the same backdrop (code unchanged); type-check, lint, arch:check, structure, feature-size and the full test run pass.

## In scope

- New feature `src/features/backdrop/` (the moved file, API, README); `arena` API and README lose the backdrop; `match` imports it from the new API; `ARCHITECTURE.md` row and import directions.

## Out of scope

- Will NOT do: any change to the backdrop's code or look.
- Will NOT touch: `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `backdrop` | Not found | the moved renderer, API, README | new — one domain (the picture behind the arena) |
| `arena` | exports the backdrop view | export removed | ride |
| `match` | imports the backdrop from `arenaApi` | imports from `backdropApi` | ride |

## Size

XS.

## Plan

`git mv` the file; add `backdropApi.ts` and the README; fix the two imports; update `ARCHITECTURE.md`. Gate: the tooling list above.

## Decisions

- D1 (closed, orchestrator 2026-11-18): room comes from moving a cohesive group, not from a budget override.
- D2 (closed, loop-plan, clear winner): the backdrop is the group to move: it has no dependency on any game feature and one consumer, so the move is two import lines. Splitting the terrain grid's own files would cut through one concept.
