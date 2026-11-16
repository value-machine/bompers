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

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1–D4 via loop-plan (D1 desk spike, clear-winner)
