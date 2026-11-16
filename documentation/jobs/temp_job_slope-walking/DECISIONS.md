# Decisions — slope-walking

Job: `temp_job_slope-walking`
Updated: 2026-11-16

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Slope walking model | closed | Design A "motor and gravity": push = accel × (1 − speed / runSpeed), pull = gravity × sin(slope); steady speed falls uphill and rises downhill, and run-up speed carries into a climb | owner (picked A of three in the design artifact) | Rejected: B speed curve (no momentum), C rolling circle body (full a3; fresh craters trap a standing blob) |
| D2 | Body path on the ground | closed | Body centre rides the terrain field contour at distance = body radius (14), so corners and rims round off | loop-refine (owner saw jumps at corners in the first sketch: feet + normal offset snaps at corners) | Same field and contour rule as the outline (terrain-curves D8) |
| D3 | Crater lip | closed | Ground ≥ 80° with its top ≤ 12 units above the feet → pull over at 25 % run; taller → no push | loop-refine | Every half-circle crater has ≈ 10 near-vertical units at its rim, at any size |
| D4 | Tilt | closed | Render-only: body leans 0.6 × slope, max 30°, damped spring | loop-refine (artifact, owner pick A) | Sim body stays axis-aligned |
| D5 | Branch base | closed | `claude/slope-walking` starts from `claude/terrain-curves` (#48, unmerged); after #48 lands, merge main in before the PR | loop-refine | Both laps change `playerController.ts`; stacking avoids a conflict and a rework of D6 |
| D7 | Body shape | closed | Round bottom (circle, radius width/2) tested on the field; head box above it, inset half a sample, tested on cells | loop-plan (+ review A4) | A box with a separate feet circle cannot take off once its corners overlap a slope; full circle is design C |
| D8 | Slope speed rule | closed | Target speed runSpeed × (1 − 0.75·sin θ) uphill, × (1 + 0.75·sin θ) downhill, approached with today's accel / decel / turn rates; run-up speed bleeds at `carryDecel` on slopes; gravity × sin θ builds speed past run downhill; no pull without input | loop-plan (review A7) | Same steady speeds as the artifact's motor formula (62 % at 30° up), and flat-ground feel (shipped tests) is unchanged |
| D6 | Materials on slopes | closed | Deferred: no per-material grip in this lap | loop-refine | Follow-up: ice slopes slide back |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1 owner pick via design artifact; D2–D6 loop-refine
