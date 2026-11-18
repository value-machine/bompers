# movers

## Purpose

Moving parts in the simulation (LEVEL_FORMAT § 11): each step the parts take their pose for the sim time, then bodies standing on a part ride with it and a part running into a body pushes it aside. The parts themselves (local fields, solid queries, drawing) live in `arena`; this feature only moves what touches them.

## Structure

| Layer    | Path                       | Purpose |
| -------- | -------------------------- | ------- |
| Services | `services/moverRide.ts`    | `stepMoverPoses(terrain, timeSeconds)` (pose = `motionPose`, keeps the previous pose); `rideMovers(terrain, bodies, { crushGapFraction })` → `RideResult` (crushed bodies, each body's squeeze and its carry this step): carry by the displacement of the point under the feet (rotation included), then push out along the part's normal; `moverDisplacement(mover, p)`; `inheritOnLeave`, `leaveVelocity`; `Squeeze`, `RideResult`, `RiderBody` (feet point + size), `MovingRider` (+ id and velocity) |
| API      | `api/moversApi.ts`         | The seam `match` uses |

## Dependencies

- `arena` (`MoverBody`, `moverDistanceAt`, `fieldDistanceAt`) through its API.
- `src/shared/utils/levelMotion.ts` (`motionPose`, `posePoint`, `unposePoint`).
- Consumed by `match` (sim step 1b, before the players and crates move).

## Decisions

- Test levels place drops as bare spawn points (`{ at }`); crates take the match's weapons setting, so mover tests need no weapon list (level-direction D6).
- Moving parts are kinematic bodies with their own local field, never written into the static field; the arena's solid queries (`fieldDistanceAt`, `rectHitsSolid`, `isSolidAt`, friction) see them, so every body (players, crates, rockets, droplets) collides with them without its own code (moving-parts D11).
- Riding is a carry by the displacement of the point under the feet, applied before the bodies' own step, so a rider never lags a frame; while riding, a body keeps its own velocity (moving-parts D12).
- A part pushes a body by its own motion at the body's centre, then out along its normal (at most 8 steps). A body still overlapping terrain after that is squeezed: the gap left is its width minus the overlap. A gap under `crushGapFraction` of the width pins it (crush, D13); a wider one centres it in the gap and reports a `Squeeze` (scale = (gap − 2) ÷ width, and the axis), so it shrinks to fit and can still move and jump. When the part lets go it steps back out of the terrain at full size (owner, change round on #64, B5).
- Pose from sim time only: no stored mover state beyond the last pose, so a restart replays exactly (moving-parts D7).
- Leaving a part (lap B-2, owner via orchestrator): `rideMovers` reports how far it carried each body. `inheritOnLeave` keeps that as a velocity per body id (`CarryMemory`, in the match state). When a body stops riding (it jumps, dives or walks off), the part's last velocity is added to the body's velocity once. It is capped at the ride speed (`MOTION_LIMITS.rideSpeed`, `leaveVelocity`), so a fast spinner can't fling anyone across the map. Crates keep only the vertical part, since they have no horizontal speed.
- Crush (lap B-2): a pinned body's record (`PinnedBody`) names the part that squeezed it and that part's normal at the body. Match eliminates pinned players with cause `crush`; a pinned crate stays put.
