# Decisions — terrain-curves

Job: `temp_job_terrain-curves`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Curved edge: shader vs spline (spike) | closed | CPU contour of the distance field (marching squares with linear crossings), drawn as the clip mask; no spline | loop-plan (desk spike) | The field holds exact distances near rims (terrain-field D4), so linear crossings at 4-unit samples sit within ≈ 0.06 units of a true circle of radius 34 (chord sag r(1 − cos(s/2r))), ≈ 0.1 px at the closest zoom: a spline adds nothing. Shader rejected: re-uploads a 173 k-sample field texture after every blast, needs a custom Pixi filter and edge anti-aliasing, and cannot be tested in Vitest |
| D2 | Untouched shapes stay sharp | closed | Mask cells whose four corner samples still hold their load-time distance are full squares (rect runs); only cells a blast touched use contour pieces | loop-plan | A blast lowers distances within rim + band (16 units), so full squares never reach a rim; authored corners keep the slab's own path |
| D3 | Ink near craters | closed | The ink mask is the same builder with the field offset by the ink width (contour of distance > −width); crater rims stay without ink | loop-plan | DESIGN_LANGUAGE § 3 (no ink line on crater edges) unchanged |
| D4 | Where the builder lives | closed | `terrainSurfaces.ts` (replaces `breakableRuns` / rect-run masks) with `terrainSurfaces.test.ts` | loop-plan | Arena services stay inside the 10-file budget |
| D5 | Breakable terrain look | closed | One solid colour slab exactly like unbreakable terrain (same slab, lip, ink); seam grid, pips, tiles and cracks removed; earth / cardboard `surface: "plain"`, `"breakable"` dropped from `MaterialSurface` | owner (Change verdict on #48, via orchestrator) | Supersedes material-system D1's breakable seam-grid cue. Kept: swatch-coloured debris and dust on hit (effects, not a lasting pattern); the kit preview's dashed outline (authoring aid only). Removed: `terrainTiles.ts`, palette `crack` |
| D6 | Walking on curved slopes | closed | Grounded step-up of up to `player.stepUp` = 8 units (2 samples) in the horizontal move, plus snap-down to ground within the same height while grounded and not rising | loop-build (owner: "walk up hills when they curve") | Cause: axis-separated box collision with no step-up; each 4-unit riser of a curved rim stopped the move (hitX → vx 0), and each step down was a fall + landing. Fixed in #48 (small, player controller). Smooth sub-sample heights and rolling stay lap a3. Superseded by slope-walking D1–D8 (ground mover on the field; `player.stepUp` removed) |
| D7 | Outline on blasted edges | closed | Crater rims and every exposed face get the same ink (width, colour) as authored edges: the shape a blast changed, grown by the outline width, filled in ink under the fills; authored edges keep their slab stroke | owner (Change verdict on #48: "outlines should trace the actual shape, also when chunks are removed") | Supersedes D3's "crater rims stay without ink" and DESIGN_LANGUAGE § 3's old rule |
| D8 | One outline rule | closed | Outline = the terrain field's contour grown by the outline width over all terrain, filled in ink under the fills; breakable fills clipped by the field's contour of breakable terrain (grow 0). The field is seeded from slabs as drawn (rect corners rounded by the slab radius ≈ 6.2), so an untouched slab's contour is its own path | owner (Change verdict on #48: ghost outlines after a platform is destroyed, "doesn't stem from one clean rule") | Supersedes the mechanisms of D2, D3 and D7 (three outline sources: slab stroke, field mask, rim ink). Removed `drawSlabInk`, `breakableMask`, `drawBreakableMasks`. Trade-off: sharp polygon tips bevel by ≤ 1 sample |
| D9 | Air distances after a blast | closed | `clearCrater` re-measures air samples within the band of the touched box (max over solid neighbours of d − distance, clamped ≤ −EDGE_EPSILON, else −band; writes only changes ≥ 0.05) | loop-build | Cause of the ghost outlines: air kept its pre-crater distance, so ink (distance > −width) stayed where terrain was gone |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1–D4 via loop-plan (D1 desk spike, clear-winner)
