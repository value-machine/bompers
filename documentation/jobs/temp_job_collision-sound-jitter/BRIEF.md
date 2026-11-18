# Collision sound jitter (bug, size S)

**Problem (owner, 2026-11-18):** the landing sound replays in rapid bursts in some spots, for example against a moving platform.

**Cause (proven with the real sim, 120 fps, 8 s per spot):** the controller counted a landing on every air → ground touchdown, including touchdowns after a single step in the air. Where the ground contact flips off and on, each flip became a landing at the speed of one step of gravity (about 12 u/s), and each landing cued `land` at `JUICE_VOLUME.minGain`:

| Spot                                                     | Landings / s before | after                          |
| -------------------------------------------------------- | ------------------- | ------------------------------ |
| Pushing into a slope that steepens into a wall (80° lip) | 51                  | 0                              |
| Standing on a spinning plank                             | 2.6 (one real fall) | 0.1 (the real fall)            |
| Running on a swinging plank                              | 5.8                 | 0.4 (real falls)               |
| Running after a receding moving block                    | 8                   | 1.25 (real hops of 7–26 steps) |
| Riding a slider or lift, being pushed, static wall       | 0                   | 0                              |

**Fix:**

1. Sim (source): `PlayerState.airSeconds`; a touchdown counts as a landing only after `LANDING_MIN_AIR_SECONDS` (0.05 s) in the air (`playerController.ts`). Velocity handling on touchdown is unchanged.
2. Sound (guard): `readSoundCues` drops a player's own cue repeating within `SOUND_MIX.bodyRetriggerSeconds` (0.15 s), and touchdowns under `SOUND_MIX.landingMinSpeed` (150 u/s) play no landing. Intensity scaling unchanged; the softest real landing (a cut hop) is about 380 u/s.

**Success check:** `matchSound.test.ts` § collision sound jitter (real sim → real cue reader): no land cue at the lip or on a spinning plank, at most one per cycle chasing a moving block. `soundCues.test.ts` § contact jitter guard.

**Left open:** running after a receding moving block still makes the blob hop a few units (real air time), about one audible soft landing per cycle after the guards. The hop looks like the ground frame tilting at the part's base; not proven, not in this lap.

## Added to the lap (orchestrator, owner reports 2026-11-18)

1. "Stuck, half squished by a moving platform, then stuck against it."
2. "On a moving platform I moved against the wall; when the platform left, my character stuck against the wall with sticky feet, and the collision sound kept playing."

**Cause (one root, reproduced on the crusher test level's squeezer):** while squeezed, the blob is its shrunken circle on the feet point, and it settles up to 3 units into the floor. `squeezeOf` measured the overlap against all terrain, so the floor overlap (above `SQUEEZE_SLOP`) read as a squeeze every step while the blob still touched the part. Each step re-centred the blob toward the part, so it stayed squeezed (scale ≈ 0.82) and travelled with the block after the gap opened. This happened standing in the gap (report 1) and after riding the block into the post (report 2).

**Fix:** `squeezeOf` reads the overlap against static terrain and the other parts (never the pusher), and only an obstacle whose normal faces the part (within 60°) squeezes. Any other overlap is stepped out of at full size. The crush in the crusher's gap still crushes.

**Success check:** `gameSim.test.ts` § leaving a squeeze: both cases fail before the fix and pass after it.
