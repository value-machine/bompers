# Brief — Slope walking: climb inclines with slope-dependent speed and body tilt

Task: owner request (direct, 2026-11-16) · Lap: temp_job_slope-walking · Harness: v0.45.0

## Problem
Blobs walking up a blasted crater still get blocked or move in steps: the 28 × 28 box climbs at most `player.stepUp` (8 units) per 2-unit move, the upper crater wall rises faster than that, ground speed ignores steepness, and the body never tilts with the ground.

## Success check
On a level with a fresh round crater (power-50 rocket into earth), a grounded blob holding right from standing at the crater bottom walks out without jumping. On straight ramps, its steady ground speed matches `runSpeed × (1 − pull·sin θ / push)` within 5 % at 30° up and 30° down. Its body centre path has no position jump larger than one move step over a crater rim or corner. Its body tilt settles at 0.6 × slope, clamped to 30°.

## In scope
- Grounded movement on the terrain field (design A, owner pick): the body centre rides the field contour at distance = body radius, ground speed is one signed scalar along that path, the run input is a motor (`push × (1 − speed / runSpeed)`), and gravity pulls along the slope (`pull × sin θ`).
- Lip rule: ground steeper than 80° whose top is at most 12 units above the feet → pull over at 25 % of run speed. Steeper and taller → no push, so the blob slides back.
- Leaving the ground: a jump, walking off an edge, or ground falling away faster than the path follows → airborne motion as today.
- Render tilt: body (with helmet and eyes) leans to 0.6 × slope, max 30°, on a damped spring; render only.
- Tunables under `player` (push, pull, lip angle, lip rise, tilt share, tilt max), with docs in the player README and DESIGN_LANGUAGE § 6.

## Out of scope
- Will NOT do: circle body for walls, ceilings and probes (design C / full lap a3): deferred.
- Will NOT do: material grip on slopes (ice slides back): deferred, backlog follow-up.
- Will NOT do: launching off crests at speed: deferred.
- Will NOT touch: airborne motion, wall-slide, wall-jump, crouch, tumble, and the box collision against walls and ceilings: they stay unchanged.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| player | `stepPlayers` → `applyHorizontal` → `applyMotion` (`moveAcross` + `climbRiser` step-up, `snapToGround`) on the box | grounded branch of `applyMotion`: field-path ground move replaces step-up and snap | new — ground mover; step-up / snap retired on the ground |
| player (render) | `blobPose` springs (helmet tilt, feet); body drawn upright | body rotation from a ground-tilt spring | new — render-only tilt |
| arena | terrain field: `sampleDistance`, contour (terrain-curves D8) | read-only query: distance and gradient at a point (bilinear) | ride — query exported via the arena api barrel |
| shared config | `gameTunables` `player.stepUp` | `player.slope { … }` | ride |
| docs | DESIGN_LANGUAGE § 6, player README, arena README | slope rule and tilt lines | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — new ground mover in the player controller, a field query in arena, render tilt, tunables and tests. The player services layer is at its 10-file budget, so new modules need a placement decision in the plan.
Cut into laps: none (material grip on slopes → backlog follow-up).

## Decisions
DECISIONS.md D1–D6. Supersedes terrain-curves D6 (step-up + snap) for grounded walking; the step-up stays only as long as the plan needs it as an airborne-landing aid.
