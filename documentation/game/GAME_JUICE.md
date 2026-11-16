# Game juice system

The feedback layer of the design system ([`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md)): how every game moment **feels** — sound, squash and stretch, flash, shake, hit-stop and effects. New game elements keep arriving; this file and its code scale keep them feeling like one game.

- **Code SSOT for the scale:** `src/shared/config/gameJuice.ts` (impact tiers, timing windows, squash band). Its test, `gameJuice.test.ts`, checks the `feel` and `player.squash` tunables against it.
- **Values stay where they live:** the `feel` and `player.squash` sections of `src/shared/config/gameTunables.ts`, the sound bank (`src/features/sound/services/soundBank.ts`), and the renderer constants named in § 6. They pick from or conform to the scale; they are not copied here.
- **Look** (colours, shapes, draw order) is DESIGN_LANGUAGE § 1–5; **sound identity and the SFX prompt template** are DESIGN_LANGUAGE § 8. This file says *which* channels a moment uses and *how strong*.

## 1. Principles

1. **Every moment answers on two channels at least: one sound and one visual.** A player must hear and see that something happened, even in a four-player pile-up.
2. **Strength follows consequence.** A moment picks one impact tier (§ 2). Your own actions are light; being hit is medium; the big moments are heavy. Never louder than the tier.
3. **Snappy, never blocking.** Feedback is render only: it never changes the simulation and never makes a player wait. Durations stay inside their window (§ 3).
4. **Squash keeps volume.** Every squash and stretch pose stays in the volume band (§ 4).
5. **Who it belongs to stays readable.** A player's own feedback may use their body colour and their pitch offset; nothing else uses either (DESIGN_LANGUAGE § 1 *Player hues are reserved*, § 8 per-player pitch). Effects never cover a player outline (DESIGN_LANGUAGE § 5).
6. **Reduced motion:** drop screen shake and idle breathing, halve the flash; keep squash (it carries gameplay information).

## 2. Impact tiers

`JUICE_TIERS` in code. A moment's tier sets every visual channel at full strength; scaling below that by speed or blast size is allowed (a light landing squashes half), going above is not.

| Tier | Use for | Shake | Flash | Hit-stop | Music duck |
|------|---------|-------|-------|----------|-----------|
| `light` | the player's own actions: jump, land, fire, pick up, respawn | — | — | — | — |
| `medium` | something hit you or you bounced: front hit, tumble bounce | 3 px | 0.75 | — | — |
| `heavy` | the big moments: back hit, explosion | 6 px | 1.0 | 50 ms | 4 dB, 300 ms |

- Summed shake is capped at **12 px** (`JUICE_SHAKE_CAP_PX`); live kicks add as a root of squares.
- Music ducking amount and length are the sound bank's `SOUND_MIX.duckDecibels` / `duckSeconds`; which sounds duck is `DUCKING_SOUNDS`.

## 3. Timing windows

`JUICE_WINDOWS` in code, seconds (one 60 fps frame ≈ 16.7 ms). A new duration picks a value inside its role's window.

| Role | Window | Built examples |
|------|--------|----------------|
| `flash` — flash hold, hit-stop | 30–70 ms | hit flash hold 50 ms, hit-stop 50 ms |
| `fade` — a flash fading out | 50–150 ms | hit flash fade 80 ms |
| `shake` — one shake kick | 60–150 ms | hit 80 ms, tumble bounce 100 ms, explosion 120 ms |
| `squash` — squash recovering, HUD pip pop | 100–200 ms | wall-jump 120 ms, jump 150 ms, land 180 ms, health pip 150 ms |
| `effect` — pop-in effect clearing | 180–320 ms | impact pop 220 ms, explosion star 250 ms |
| `linger` — things flying off | 300–600 ms | elimination droplets 300 ms, debris 500 ms |

Loops (idle breathing 1.6 s, respawn blink 8 Hz) are not bound by a window.

## 4. Squash and stretch

`JUICE_SQUASH` in code: body scale `sx · sy` stays in **0.93–1.01**, and each axis stays in **0.75–1.25**. The land pose (1.25, 0.75) is the strongest allowed. A new pose:

- squashes **wide** on impact (landing, a hit taken, a bounce) and stretches **tall** on launch (jump, wall-jump push);
- recovers with a back-out overshoot inside the `squash` window;
- scales its amount by the impact (speed / full-impact speed), never above the preset;
- kicks the helmet spring (`feel.helmet`) in the same frame, so body and helmet answer together.

Feet lag the body by two frames and squash flatter (`player` feature, `blobPose.ts`).

## 5. Sound

Sound identity, the four sound families, the prompt template, post-processing and the chosen takes are DESIGN_LANGUAGE § 8. For a new moment:

- Pick its **family** (body, impacts, weapon, round & UI) and build the prompt from that family's words and materials; target length from the family row.
- Pitch it by the player it belongs to (`PLAYER_PITCH_SEMITONES`): actions by the actor, hits and eliminations by the victim; world and round sounds are unpitched.
- Loudness: −16 LUFS files; per-cue gain only to scale with impact (landings: `SOUND_MIX.minLandingGain` → 1 by fall speed). A `heavy` moment's sound ducks the music.
- Register the sound ID in the content catalog and the sound bank (the sound bank test checks it), and cue it from sim events in `soundCues.ts` — never from render code.

## 6. Moment ledger

Every built game moment with its tier and channels. Add a row for each new moment in the same lap that builds it.

| Moment | Tier | Sound | Squash | Flash | Shake | Hit-stop | Effect | Helmet |
|--------|------|-------|--------|-------|-------|----------|--------|--------|
| Jump / wall-jump | light | `jump` | stretch tall | — | — | — | — | kick |
| Land | light | `land` (gain by speed) | squash wide (by speed) | — | — | — | — | kick |
| Rocket fire | light | `rocket-fire` | — | — | — | — | — (visual: the recoil row) | — |
| Rocket recoil | light | `rocket-fire` (the fire cue) | — | — | — | — | body kick opposite the aim (sim impulse `combat.rocket.recoil`) | — |
| Pickup collected | light | `pickup` | — | — | — | — | — | — |
| Headbutt reset taken | light | `pickup` (pitched by the collector) | — | — | — | — | ring burst in the crystal colour, 220 ms; then a ghost outline until it is back | — |
| Headbutt reset returns | — | — (deliberately silent: a world timer every 2.5 s would be noise) | crystal pop-in, back-out 150 ms | — | — | — | — | — |
| Respawn | light | `respawn` | — | — | — | — | blink 8 Hz + ring | — |
| Dive launch | light | `dive-launch` | dive pose | — | — | — | — | — |
| Front hit taken | medium | `hit` / `dive-impact` | — | 0.75 | 3 px | — | impact pop (not on dive hits) | kick |
| Tumble bounce | medium | `tumble-bounce` | squash wide (by speed) | — | 3 px (by speed) | — | — | kick |
| Dive wall bonk | medium | `dive-impact` | — | — | — | — | — | — |
| Back hit taken | heavy | `hit` / `dive-impact` | — | 1.0 | 6 px | 50 ms | impact pop (not on dive hits) | kick |
| Explosion | heavy | `explosion` (ducks music) | — | — | 6 px (by radius) | — | star burst | — |
| Terrain destroyed | light | material's sound | — | — | — | — | debris | — |
| Elimination | heavy | `elimination` | — | — | — | — | **gap:** droplets + confetti (DESIGN_LANGUAGE § 6) not built yet | — |
| Health chunk lost (HUD) | — | — | pip pop | — | — | — | — | — |
| Round start / end | — | `round-start` / `round-end` | — | — | — | — | banner | — |
| Final 30 s build-up | — | music build-up for the last 30 s | — | — | — | — | timer turns orange and pulses in the last 10 s (HUD) | — |

Rows marked **gap** break § 1 today; the lap that builds the missing channel fills the row.

Where the values live: shake / flash / hit-stop / helmet in `feel` tunables (read by `effects/feelCues.ts`, `camera/cameraShake.ts`, `player/playerRenderer.ts`); squash presets in `player.squash` (`player/blobPose.ts`); effect timings in `effects/effectsRenderer.ts`; HUD pops in `match/hudRenderer.ts`; sound in the `sound` feature.

## 7. Checklist for a new game element

1. List the element's moments (spawn, act, hit, break, vanish …) and give each a ledger row (§ 6).
2. Pick each moment's tier (§ 2) by consequence; reuse the tier values — no new shake or flash numbers.
3. Give each moment one sound and at least one visual channel (§ 1).
4. Pick durations inside the windows (§ 3) and squash poses inside the band (§ 4).
5. New tunable values go in the owning section of `gameTunables.ts`, reading from `gameJuice.ts` where a tier applies; extend `gameJuice.test.ts` when a new `feel` value is added.
6. Sound: family, prompt template and registration per § 5.
7. Check reduced motion (§ 1.6) and that the effect draws under the player outlines.
