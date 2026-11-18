# Brief — Mover materials, lap 4: blasts break moving parts

Task: blasts break moving parts like terrain (owner, 2026-11-18, via the orchestrator; route: `temp_job_mover-materials/DECISIONS.md` D1–D3) · Lap: temp_job_mover-materials-l4 · Harness: v0.45.0

## Problem

A rocket explodes on a moving part and leaves no mark: craters are cut only out of the static grid, and the level format says blasts never break a part. A cardboard lift burns away but cannot be blasted.

## Success check

A blast at a cardboard or earth part cuts a crater out of the part where the part is at that moment (moved or turned), as wide as the same blast cuts that material on the ground; a stone or ice part and a frozen patch stay whole; one blast that reaches the ground and a part cuts both and reports both looks; bodies no longer collide with the removed samples and the part's outline and fill follow. Craters on static terrain are unchanged.

## In scope

- `arena`: `clearCraterOnBodies` (the static terrain and every part the blast reaches), in a new bodies module that also takes the body-list functions out of `terrainGrid.ts`.
- `combat`: blasts call it.
- `fire`: shares the arena's pooling of removed looks (it had its own copy).
- Level format § 11, W13 (the material warning goes), level prompt and kit text: a part is made of its material like any terrain.

## Out of scope

- Will NOT do: loose pieces. A part cut in two keeps moving as two pieces, as terrain cut off floats (the options page's approach 4, not chosen).
- Will NOT do: fire or cold crossing between bodies (lap 5 dropped by the owner, D2).
- Will NOT touch: the player controller and roll; `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `arena` | `clearCrater(grid, crater)` on the static grid; body functions inside `terrainGrid.ts` | `services/terrainBodies.ts` | ride (room made by the backdrop move, PR #92) |
| `combat` (`explosions.ts`) | `clearCrater(ctx.terrain, …)` | `clearCraterOnBodies` | ride |
| `fire` | own pooling of removed looks per batch | the arena's `poolCleared` | ride |
| `level-file`, `level-kit`, `documentation/game` | W13 material warning; "blasts never break a moving part" | warning removed; text | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S.

## Plan

Conflict & compliance: architecture (the new module imports the grid functions, never the other way round; `arena/services` is at 10 files with it, so its tests share `terrainGrid.test.ts`); code-style F1 (`terrainBodies.ts`, `clearCraterOnBodies`, `ClearedBodies` name roles), F2 (pooling of removed looks existed in fire; with the blast it would be the second copy, so it is one function in the arena now); performance (a blast adds one reach check per part and a crater pass only on parts in reach).

1. `terrainBodies.ts`: move `terrainBodies`, `bodyGrids`, `bodyWorldPoint`, `frozenVersionOf`; add `poolCleared`, `clearCraterOnBodies` (crater centre mapped into the part's frame; parts out of reach skipped).
2. `combat`: blasts cut every body. `fire`: use `poolCleared`.
3. Tests: a cardboard part cut where it is (moved, turned), a stone part and a frozen part whole, one blast pooling ground and part.
4. Text: § 11, W13, prompt, kit, READMEs.

Gate: type-check, lint, arch:check, validate:structure, validate:feature-size, level-kit:check, full test run.

## Decisions

| id | topic | status | choice |
|----|-------|--------|--------|
| D1 | May blasts break moving parts | closed (owner, 2026-11-18, via the orchestrator) | Yes, like terrain: cardboard and earth crater, stone and ice stay whole |
| D2 | Fire crossing between a part and the ground it touches (lap 5) | closed (owner, 2026-11-18, via the orchestrator) | No: each body burns alone. Lap 5 is dropped |
| D3 | Room in `arena/services` | closed (orchestrator) | A role-named move, no budget override: the backdrop became its own feature (PR #92) |
| D4 | W13's material warning | closed (loop-plan, follows from D1) | Removed: every material now behaves on a part as it does on the ground |
| D5 | A part cut in two | closed (loop-plan, consistent with terrain) | Both pieces keep moving; nothing falls. Falling pieces are the route's approach 4, which the owner did not pick |
