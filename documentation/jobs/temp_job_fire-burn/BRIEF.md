# Brief — Fire b2: blobs catch fire

Task: Fire: spreading fire, flamethrower and burn reaction — lap b2 (owner recut, fire-spread D1) · Lap: temp_job_fire-burn · Harness: v0.45.0 · Orchestrator run `run:bompers-game-2` (thread `fire-design`) · Stacked on #53 (`claude/fire-spread`) until it lands

## Problem
Fire burns terrain (b1) but blobs ignore it: touching flames or the torch does nothing to a player.

## Success check
A blob that touches burning terrain or the torch's flame catches fire. It burns 2 s: one chunk at 1 s, and a second as it goes out at 2 s unless it is crouching then (owner D10), unless it first touches ice or starts a dive (put out) or bumps a rival (the fire jumps to the rival). While burning it keeps full control. With no move input it runs away from the fire at full run speed (off ledges too). It shows the owner's picked panic look: drawn hops, pinprick pupils, flying sweat, helmet flames, and steam / blown-off / leap / smoke effects.

## In scope
- Burn state per blob in the fire feature (start time, where the fire came from, who lit it).
- Catching: from a burning terrain sample touching the body, or from a torch ray reaching the blob.
- Ending: ice touch (steam), dive wind-up or travel (flames blown off), bump (passed to the rival, leap), 2 s (−1 chunk through combat's `applyHit`, smoke).
- Flee: no move input while burning → move input away from the fire source (match patches the input; ledges are not avoided).
- Look: drawn panic hops and pinprick pupils through the player renderer's pose overlay; helmet flames, sweat, effects in the fire layer; sound cues per moment (placeholders where no take exists, fire-spread D8).

## Out of scope
- Will NOT do: real sim hops (owner picked drawn hops); burning crates or other bodies; fire damage over time beyond the one chunk; new audio files.
- Will NOT touch: tumble / roll (Shared roll lap); `reactToHit` beyond calling it with zero impulse on the burn chunk.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| fire | terrain fire + torch (b1) | burning blobs, panic input, panic pose, blob effects | ride (same feature) |
| combat | `applyHit` kinds `contact` / `blast`; crouch halves damage | hit kind `burn` (1 chunk any side), source `fire`; crouch does not halve burns | ride |
| player | `BlobPoseOverlay { rotation, sx, sy }` | optional `lift` and `pupilScale` (render only) | ride |
| match | input → `stepPlayers`; contacts; render overlays | panic input patch, burning-blob step after fire, overlay merge, fire frame with players | ride |
| sound | per-player counters → cues | `catchFireCount`, `fireOutCount` counters | ride |
| shared | tunables | `fire.blob` section | ride |

## Size
M — one new fire service, small hooks in combat, player render, match, sound.

## Decisions
DECISIONS.md D1–D9.

## Plan (size M, short)
Acceptance: `src/features/fire/services/burningBlobs.test.ts` (catch, torch catch, burn down, ice, dive, bump, flee, control kept) + sound cue tests.
1. Data: `HitKind` `burn`, `HitSource` `fire`, `hitDamage.burn`, crouch skip; `fire.blob` tunables; palette sweat / steam / smoke.
2. Sim: `burningBlobs.ts` (`catchFire`, `stepBurningBlobs`, `panicInputs`); torch calls `catchFire`; match step 3d + input patch.
3. Look: overlay `lift` / `pupilScale` in the player renderer; `blobFireRenderer.ts`; match merges overlays.
4. Sound: two per-player counters → placeholder cues.
5. Docs: READMEs, juice ledger, design language, vision.

Pattern & precedent: burning status with a timer, extinguish on water, spread on touch, and panic flee are the common shape of burn status effects in action games; no divergence.
