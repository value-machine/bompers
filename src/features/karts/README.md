# karts

## Purpose

Drivable go-karts a level places (`<rect data-role="object" data-kind="kart">`, kart lap; owner picks "Car Options" Q1–Q4). A kart is two **wheels** — physics-objects round bodies, so they fall, roll, bump, ride moving parts, take blasts, rockets, fire and frost and pop there — plus a **chassis** held above the axle line on a damped spring. This feature holds the wheels together, springs the chassis, seats drivers, drives and hops, keeps fire and frost whole across the kart, and turns fast contacts into hits. Variants are data lines in `level-objects/services/kartRecipe.ts`.

## Structure

| Layer    | Path                         | Purpose                                                                                                                                                                                                                                                                                   |
| -------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services | `services/kartModel.ts`      | Types only (in `services/` because they name physics-objects' `PhysicsObject` through its API, which a `types/` file may not import): `Kart` (wheels, spring offset and speed, facing, driver, whole-object state, speed at step start), `ChassisShape` (capsule along the axle line), `KartsState` (karts, down / jump held per player, hit cooldowns)                                                                         |
| Services | `services/kartBody.ts`       | `chassisOf`, `nearestOnChassis`, `axleOf`, `holdWheels` (wheel base, terrain-safe), `stepSpring` (the chassis lags the axle's speed changes, settles in the `settle` window), `kickSpring`, `driveKart` (stick toward `driveSpeed` along the axle line, hop on a fresh jump; frozen = no grip) |
| Services | `services/kartSeats.ts`      | `stepSeats` (a fresh down press touching an empty kart gets in, the next gets out), `seatDriver` / `seatDrivers` (feet low in the tub), `leaveKart` (beside the kart via the player's `escapeSolid`), `ejectDriver`, `driverIds`, `touchesKart`, `kartInPlay`                        |
| Services | `services/kartContacts.ts`   | `bumpKartsAndBlobs`: a blob on top stands on the chassis (carried, can jump), from the side a bump by weight (kart gives way first); a kart moving into a blob faster than `karts.hitSpeed` returns a `KartHit` (cooldown per kart and blob)                                             |
| Services | `services/karts.ts`          | `createKartsState(level, physics)` (wheels via `addRoundBody`), `seatedInputs`, `driveKarts` (before the physics step), `stepKarts` (whole state, pops with the driver out first, wheels, spring, contacts → hits), `kartRoundBodies` (rockets), `kartEngines` (sound)                      |
| Services | `services/kartRenderer.ts`   | Kart layer above the blobs (the driver sits in the tub): tyres turning with the wheels, a rounded tub in the variant's body colour with a trim stripe, ink outline at the character width; spring squash, pop-in, flames and frost over the whole kart                                    |
| API      | `api/kartsApi.ts`            | Public seam                                                                                                                                                                                                                                                                               |

Seams for later work:

- **Another car:** one data line in `kartRecipe.ts` (size shares, weight, drive, hop, spring, colours), then `pnpm level-kit:sync`.
- **Engine hum:** `kart-idle` and `kart-drive` loops (sound `KART_ENGINE_SOUNDS`; owner pick take 3, drive = the same take resampled 1.4×). Another car's engine would be its own pair of loops.

## Dependencies

- `physics-objects` (round bodies, moments, `popObject`, `moveObjectSafely`, `wakeObject`), `player` (`escapeSolid`, `placePlayer`, `moveAxis`), `level-objects` (`findPhysicsVariant`), `arena` and `level` (types), `src/shared/types/physicsBody.types.ts` (`KartBodySpec`), the `karts` tunables.
- Consumed by `match`: seats before step 2 (`stepSeats`, `seatedInputs`, `seatDrivers`), `driveKarts` before step 3g, `stepKarts` as step 3h (hits → combat `applyHit`, source `kart`), rockets (`kartRoundBodies`), the render layer and sound (`kartEngines`).

## Decisions

Lap record: `documentation/jobs/temp_job_physics-kart/DECISIONS.md` (K1–K10).

- **K2 — wheels are round bodies, the chassis a spring lag (agent):** everything a ball does, the wheels do with no new code; the chassis is not a body against terrain, so a kart can never wedge a blob.
- **K4 — seated driver (agent):** stays in the players' step with its stick, jump and down taken by the kart (aim and fire kept: it fires from the seat; unarmed it has no dive), skips blob contacts and the never-stuck step, and sits on the seat after its step and the kart's.
- **K5 — in and out (agent):** a fresh press of down while touching an empty kart (keyboard: the half's down key S / ↓; gamepad: d-pad down or the stick pushed down). Boarding happens on the press, so crouch and crouch-roll (down held on the ground) never start; out puts the blob beside the kart with `escapeSolid` (the shared `freeSpotSearch`).
- **K7 — hits (agent, owner Q3):** `karts.hitSpeed` 380 (above the run speed 340, below the go-kart's 520), one per 0.5 s per blob, credited to the driver, never the own driver.
- **K8 — riding (agent):** the chassis is never terrain to a blob; on top it stands, from the side it is a bump by weight.
- **K9 — engine (agent, owner Q4):** two loops crossfaded by speed, pitched by the driver.
- **Whole-object state (owner rule):** one wheel's fire or frost goes to the whole kart; a burning kart puts its driver out; a popped wheel pops the kart, driver out first; it comes back after 3 s.
