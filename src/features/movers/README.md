# movers

## Purpose

Moving parts in the simulation (LEVEL_FORMAT § 11): each step the parts take their pose for the sim time, then bodies standing on a part ride with it and a part running into a body pushes it aside. The parts themselves (local fields, solid queries, drawing) live in `arena`; this feature only moves what touches them.

## Structure

| Layer    | Path                       | Purpose |
| -------- | -------------------------- | ------- |
| Services | `services/moverRide.ts`    | `stepMoverPoses(terrain, timeSeconds)` (pose = `motionPose`, keeps the previous pose); `rideMovers(terrain, bodies)` → indices of pinned bodies: carry by the displacement of the point under the feet (rotation included), then push out along the part's normal; `moverDisplacement(mover, p)`; `RiderBody` (feet point + size) |
| API      | `api/moversApi.ts`         | The seam `match` uses |

## Dependencies

- `arena` (`MoverBody`, `moverDistanceAt`, `fieldDistanceAt`) through its API.
- `src/shared/utils/levelMotion.ts` (`motionPose`, `posePoint`, `unposePoint`).
- Consumed by `match` (sim step 1b, before the players and crates move).

## Decisions

- Moving parts are kinematic bodies with their own local field, never written into the static field; the arena's solid queries (`fieldDistanceAt`, `rectHitsSolid`, `isSolidAt`, friction) see them, so every body (players, crates, rockets, droplets) collides with them without its own code (moving-parts D11).
- Riding is a carry by the displacement of the point under the feet, applied before the bodies' own step, so a rider never lags a frame; a rider keeps its own velocity (moving-parts D12).
- A part pushes a body by its own motion at the body's centre, then out along its normal (at most 8 steps). A body still overlapping terrain after that is pinned; `rideMovers` reports it and the crush rule acts on it (moving-parts D13, lap B-2).
- Pose from sim time only: no stored mover state beyond the last pose, so a restart replays exactly (moving-parts D7).
