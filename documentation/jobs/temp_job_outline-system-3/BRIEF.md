# Brief — Outline system, lap 3: element overlays

Task: approach B, lap 3 (`temp_job_outline-system/BRIEF.md` § Laps; owner pick B, 2026-11-19) · Lap: temp_job_outline-system-3 · Harness: v0.45.0 · Base: main 68192dc (#98)

## Problem

The fire's burning body still draws its ink the old way: the burning region grown by the outline width and filled in ink under the ember fill. A late ember fill shows the whole body in ink (green with `?debugInk=1`), the grown ink reaches unevenly into unburnt terrain, and at a far zoom it could flood all terrain in the fire's box. Frost cuts its lip with its own copy of the slab's lip rule.

## Success check

The burning body's ink is strokes only, along the body's edge, on the static terrain and on parts. No app code passes a positive `grow` to `terrainContour`. Slabs and frost cut their lip with one helper. Fire and frost look as before, except that the fire's ink line is now the same width all round.

## In scope

- `fireRenderer.ts`: body ink through `terrainRings` + `drawOutline`.
- `belowLipRegion(grid, region, above)` for slabs (`terrain`) and frost (`region`); frost's own `underLip` removed.
- Arena API exports, tests, READMEs.

## Out of scope

- Will NOT do: flames', sprays' and breaths' own ink shapes (small, per shape, redrawn every frame); goo stains (no ink).
- Cut from this lap, reported to the orchestrator as a possible later task: one width and join source for props, blobs and effects. Their widths already come from `outlineWidth` kinds; the rest is a handful of fixed numbers in six features, with look risk and no bug behind it.
- Will NOT touch: `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `fire` | body ink = `terrainContour(grow: ink, region)` filled | `drawBody` | ride |
| `ice` | `underLip` in the renderer | `belowLipRegion(…, "region")` | ride |
| `arena` | builder not exported | `arenaApi`, `belowLipRegion` `above` option | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S.

## Plan

1. Test first: the burning body's ink holds strokes only.
2. Export `terrainRings`, `drawOutline`, `belowLipRegion`; give `belowLipRegion` its `above` option.
3. `drawBody` strokes the body's rings; frost uses the shared lip cut.
4. READMEs.

Gate: type-check, lint, arch:check, validate:structure, validate:feature-docs, full test run, one headless smoke.

## Notes during development

- Headless smoke (fire-test-level, 700 frames burning and cratering): no console errors, no black, no terrain ink spikes. Visible fire-body ink is about a third more than before (2,553 px against 1,883 px at the same frame): the line now has the full outline width along the fire's edge inside the terrain, where the grown shape was thinner and uneven. A look change for the owner to judge.
- Not verified: the fire's line on a real screen; frost on a real screen (covered by the existing frost tests only).
