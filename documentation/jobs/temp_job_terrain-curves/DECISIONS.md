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
| D6 | Walking on curved slopes | closed | Grounded step-up of up to `player.stepUp` = 8 units (2 samples) in the horizontal move, plus snap-down to ground within the same height while grounded and not rising | loop-build (owner: "walk up hills when they curve") | Cause: axis-separated box collision with no step-up; each 4-unit riser of a curved rim stopped the move (hitX → vx 0), and each step down was a fall + landing. Fixed in #48 (small, player controller). Smooth sub-sample heights and rolling stay lap a3 |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1–D4 via loop-plan (D1 desk spike, clear-winner)
