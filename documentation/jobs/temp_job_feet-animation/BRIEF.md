# Brief — Feet animation: rotation, dynamics and wall-facing feet

Task: Feet animation: rotation, dynamics and wall-facing feet (owner feedback round 2, § 3 + § 2.5) · Lap: temp_job_feet-animation · Harness: v0.45.0

## Problem
The feet only bob straight up and down (`footLift`) with a fixed upright orientation; they never rotate, swing or react, and a wall-sliding blob keeps its upright pose instead of planting its feet on the wall.

## Success check
A pure `stepFeetMotion` returns, per foot, rotation and offset that change with the run cycle (toe tilt + forward swing), the air state (tilt with vertical speed, splay on landing via a damped spring), and turn the soles toward the wall (rotation ≈ wallDir·π/2, feet on the wall side) while `wallDir ≠ 0` airborne and briefly after a wall-jump off `lastWallDir`.

## In scope
- Render-only foot pose service (pure TS, unit-tested) in `features/player/services/`: run cycle with swing, lift and toe tilt; airborne tilt from vy/vx; landing splay and jump kick on a damped spring; wall-slide and wall-jump orientation blended in/out.
- Renderer applies per-foot rotation around the foot centre (both ink and fill trees).
- Feet feel numbers in `GameTunables.feel.feet` (next to `feel.helmet`) so the game-juice thread can fold them in.
- DESIGN_LANGUAGE § 6 + player README lines for the new foot motion.

## Out of scope
- Will NOT do: sprite size / collision changes (dropped by the owner); crouch (queued lap hides the feet); body/helmet changes.
- Will NOT touch: the sim (`playerController.ts`, `PlayerState` fields, jump physics, recoil — parallel thread).

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| player (render) | syncPlayersView → blobPose → placeFeet (lift + squash only) | foot motion in `blobPose.ts`, `placeFeet` | ride — same render path |
| shared tunables | feel.helmet spring settings | `feel.feet` in gameTunables.types.ts + gameTunables.ts | ride |
| match (render wiring) | gameRenderer passes `feel.helmet` to syncPlayersView | one `feet: state.tunables.feel.feet` option | ride — added in build, same pattern as helmet |
| documentation/game | DESIGN_LANGUAGE § 6 motion table | foot motion lines | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — one feature's render path plus one tunables block; no sim change.
Cut into laps: none

## Decisions
DECISIONS.md D1–D4.
