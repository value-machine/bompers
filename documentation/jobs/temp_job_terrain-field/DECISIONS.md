# Decisions — terrain-field

Job: `temp_job_terrain-field`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Sample spacing | closed | 4 units: catalog default and shipped levels; `data-cell-size` keeps its meaning (sample spacing) | loop-refine | clear-winner — owner D18 "~4 units"; no format change. Rejected: engine forcing 4 and ignoring the attribute |
| D2 | Field storage | closed | Keep `TerrainGrid` (slot per sample) and add `distance` (Float32, signed, positive inside, clamped to ±4 samples) and `anchored` (Uint8); a sample is solid exactly while its distance > 0 | loop-plan | clear-winner — existing queries keep working; no rename churn across 6 features. Rejected: a separate field object beside the grid (two sources of truth) |
| D3 | Seeding | closed | Signed distance per level shape (rect, circle, polygon), union = max; material per sample by today's overlap rule | loop-plan | clear-winner — exact outside shapes, a safe bound inside overlaps |
| D4 | Crater on the field | closed | distance = min(distance, shapeDistance(p − centre) − reach ÷ toughness); cleared when ≤ 0 | loop-plan | Same rim as blast-power D1 (|p−c|·t ≤ reach) for the round shape |
| D5 | Crater shape slot | closed | `craterShape: "round"` on each weapon's tunables; `craterShapeDistance` in `src/shared/utils/craterShape.ts`; a new shape is a new union member + its distance rule | loop-plan | Owner D17; only round ships (no unused variants) |
| D6 | One write path (blast-power D20) | closed | `writeSample(grid, { cx, cy, slot, distance })` is the only writer; `clearCrater` returns the touched cell box | loop-plan | Keeps the later falling-parts lap possible |
| D7 | Anchored | closed | Set at load for unbreakable samples and samples in the world's bottom row | loop-plan | Per D20. Open for the falling-parts lap: islands with no unbreakable sample (all-breakable floating platforms) need their own anchor rule |
| D8 | Seams between touching shapes | closed | Interior samples are lifted to at least (distance to the nearest empty sample − half a sample diagonal); exposed unbreakable samples next to a fresh crater are bounded the same way | loop-build | The union max alone reads a cardboard / earth seam as an edge (caught by the acceptance test) |
| D9 | Tests stay in `terrainGrid.test.ts` | closed | Field logic lives in `terrainGrid.ts`; its tests join `terrainGrid.test.ts` | loop-build | Arena services are at their 10-file budget; a `terrainField.test.ts` without a module breaks colocation |
| D10 | Air-side distance after a crater | closed | Air samples keep their old distance (a lower bound in magnitude); a2r re-measures where it draws | loop-build | Solid-side distances are exact, which is what the contour needs most |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1 via loop-refine (clear-winner); D2–D7 via loop-plan
