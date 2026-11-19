# Brief — Outline system, lap 1: terrain and part ink as a line

Task: "black lines bug … centralize the outlining … one more robust system, also consider the rounded corners / terrain shapes" (owner, 2026-11-18) · Lap: temp_job_outline-system · Harness: v0.45.0 · Base: main f5cdb61 (#94)

## Problem

Big black shapes flash for a few frames while large chunks burn. With `?debugInk=1` the owner saw them in magenta: the static terrain's ink. That ink is not a line. It is the whole terrain grown by the outline width, filled in ink, with the slab fills drawn on top (the breakable ones through a stencil mask). Any frame in which a fill is late, missing or smaller shows the full ink shape under it. Two attempts to reproduce the flash offline found no such frame (PR #80; one headless run of the real game on a9a5b2a: 1,500 frames burning and cratering, no ink spike), so the cause of the missing fill is not proven. The class is: an ink shape exists under the fill.

## Success check

The terrain's and every moving part's ink is drawn as strokes along the edge of the terrain shape, never as a filled shape. With every terrain fill withheld, the only ink on screen is a band of twice the outline width along the edges. The outline looks as before on untouched slabs, crater rims, burnt edges and parts, at every zoom.

## In scope

- One outline builder in the arena: `terrainRings(grid, options)` gives the edge of the one terrain shape (the same shape and options as `terrainContour`) as closed rings; `drawOutline` strokes rings at twice the visible width with round joins.
- Static terrain and moving parts draw their ink with it. Rings are rebuilt when the terrain changes; a zoom step only restrokes.
- Tests, arena README, DESIGN_LANGUAGE § 3 and § 5 wording.

## Out of scope

- Will NOT do in this lap: fills from the field (one fill and one lip per joined shape, no stencil mask) → lap 2. Fire body, flames, frost and stains through the builder, the cap on `grow`, one width source for props → lap 3.
- Will NOT touch: the distance field, collision, `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `arena` | ink = `terrainContour(grid, { grow: width })` filled under the fills, per terrain change and per width step | `terrainRings` + `drawOutline` in `terrainSurfaces.ts`; `syncTerrainView` | ride |
| `documentation/game` | DESIGN_LANGUAGE § 3, § 5 describe the grown, filled ink | two sentences | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S. One feature, no new files in `src/`.

## Laps of approach B (owner pick, 2026-11-19)

1. **This lap (S):** terrain and part ink as a line from the shared ring builder.
2. **Fills from the field (M):** each material's fill comes from the field's shape, so touching shapes are one fill with one lip (absorbs #94's square joins: today the fills still round every corner and a pillar under a slab keeps its own lip); the stencil mask goes away; rebuilds limited to the changed region.
3. **Elements and widths (M):** fire body, frost and stains use the builder (fire ink as a line, one contour pass per body); `grow` is capped below the flood thresholds; props, blobs and effects take their width and join style from one place.

## Plan

Conflict & compliance: architecture (arena only, no new imports), code-style F1/F2 (the builder is named for its role and reuses the contour's cell walk; no second marching pass is copied), file budget (arena services stay at 10 files: code in `terrainSurfaces.ts`, tests in `terrainSurfaces.test.ts`), game-juice "owner picks first" (the owner picked approach B on the options page; the line's look is meant to stay as it is), testing (ring expectations derive from the shipped contour and field).

1. Failing tests: rings closed, wound, one segment per straight edge, no repeated or broken points after craters and burn-outs; the view's ink holds strokes only; a zoom step restrokes the same rings.
2. `terrainRings`: per contour cell, the piece of edge from where the corner walk leaves the shape to where it enters again; pieces joined by the id of the grid edge they share; rings tidied (repeated points, straight runs).
3. `drawOutline`; `syncTerrainView` keeps rings per body and strokes them.
4. Docs.

Gate: type-check, lint, arch:check, validate:structure, validate:feature-size, validate:feature-docs, arena tests, full test run; one headless smoke of the real game with `?debugInk=1`.

Acceptance test: `src/features/arena/services/terrainSurfaces.test.ts` › "terrain ink (outline-system: a line, never a shape under the fill)".

## Notes during development

- Phases 1–4 done.
- Headless smoke (fire-test-level, 900 frames burning and cratering both slabs and both cardboard parts; crusher level, 120 frames): no console errors, no ink spikes. Terrain ink visible at rest: 4,608 px (main: 4,586), so the outline's visible width is unchanged. With every terrain fill withheld: 11,531 px of terrain ink, the band along the edges. On main the withheld fills would show the two big slabs alone as about 115,000 px.
- Found, not changed: a slab edge that lies exactly on a sample centre is drawn 0.9 units outside the authored edge (the sample on the edge counts as solid). The ring follows the field, as the old ink did.
- Not verified: the flash itself (never reproduced), a real GPU, high-DPI screens, the look of round joins on a real screen.
