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
| `medium` | something hit you or you bounced: front hit, roll bounce | 3 px | 0.75 | — | — |
| `heavy` | the big moments: back hit, explosion | 6 px | 1.0 | 50 ms | 4 dB, 300 ms |

- Summed shake is capped at **12 px** (`JUICE_SHAKE_CAP_PX`); live kicks add as a root of squares.
- Music ducking amount and length are the sound bank's `SOUND_MIX.duckDecibels` / `duckSeconds`; which sounds duck is `DUCKING_SOUNDS`.

## 3. Timing windows

`JUICE_WINDOWS` in code, seconds (one 60 fps frame ≈ 16.7 ms). A new duration picks a value inside its role's window.

| Role | Window | Built examples |
|------|--------|----------------|
| `flash` — flash hold, hit-stop | 30–70 ms | hit flash hold 50 ms, hit-stop 50 ms |
| `fade` — a flash fading out | 50–150 ms | hit flash fade 80 ms |
| `shake` — one shake kick | 60–150 ms | hit 80 ms, roll bounce 100 ms, explosion 120 ms |
| `squash` — squash recovering, HUD pip pop | 100–200 ms | wall-jump 120 ms, jump 150 ms, land 180 ms, health pip 150 ms |
| `effect` — pop-in effect clearing | 180–320 ms | impact pop 220 ms, explosion star 250 ms |
| `linger` — things flying off | 300–600 ms | elimination droplets 300 ms, debris 500 ms |

Loops (idle breathing 1.6 s, respawn blink 8 Hz) are not bound by a window. Owner exceptions (elimination-goo lap): knockout pieces stay until the respawn (2 s, blinking 8 Hz for the last 0.5 s) and goo stains fade out by 4 s.

## 4. Squash and stretch

`JUICE_SQUASH` in code: body scale `sx · sy` stays in **0.93–1.01**, and each axis stays in **0.75–1.25**. The land pose (1.25, 0.75) is the strongest allowed. A new pose:

- squashes **wide** on impact (landing, a hit taken, a bounce) and stretches **tall** on launch (jump, wall-jump push);
- recovers with a back-out overshoot inside the `squash` window;
- scales its amount by the impact (speed / full-impact speed), never above the preset;
- kicks the helmet spring (`feel.helmet`) in the same frame, so body and helmet answer together.

Feet lag the body by two frames and squash flatter (`player` feature, `blobPose.ts`). The eyes never squash: every squash and stretch leaves them their size and shape on the squashed face (owner, squish-eyes; `playerRenderer.ts` `placeEyes`).

## 5. Sound

Sound identity, the four sound families, the prompt template, post-processing and the chosen takes are DESIGN_LANGUAGE § 8. For a new moment:

- Pick its **family** (body, impacts, weapon, round & UI) and build the prompt from that family's words and materials; target length from the family row.
- Pitch it by the player it belongs to (`PLAYER_PITCH_SEMITONES`): actions by the actor, hits and eliminations by the victim; world and round sounds are unpitched.
- Loudness: −16 LUFS files; per-cue gain only to scale with intensity (`intensityGain` in `gameJuice.ts`: `JUICE_VOLUME.minGain` → 1 at the moment's full speed; landings by fall speed up to `SOUND_MIX.landingFullSpeed`, hits and wall bonks by impact speed up to `SOUND_MIX.hitFullSpeed`). A `heavy` moment's sound ducks the music.
- Register the sound ID in the content catalog and the sound bank (the sound bank test checks it), and cue it from sim events in `soundCues.ts` — never from render code.

## 6. Moment ledger

Every built game moment with its tier and channels. Add a row for each new moment in the same lap that builds it.

| Moment | Tier | Sound | Squash | Flash | Shake | Hit-stop | Effect | Helmet |
|--------|------|-------|--------|-------|-------|----------|--------|--------|
| Jump / wall-jump | light | `jump` | stretch tall | — | — | — | — | kick |
| Land | light | `land` (gain by speed) | squash wide (by speed) | — | — | — | — | kick |
| Shot (any weapon whose readiness drops) | light | the weapon's fire cue (`rocket-fire`) | barrel pop 0.78 × 1.22, 200 ms back-out (`feel.barrelPop`) | — | — | — | mouth accent drops to 15 % and refills with the cooldown | — |
| Rocket recoil | light | `rocket-fire` (the fire cue) | — | — | — | — | body kick opposite the aim (sim impulse `combat.rocket.recoil`) | — |
| Pickup collected | light | `pickup` | — | — | — | — | — | — |
| Headbutt reset taken | light | `pickup` (pitched by the collector) | — | — | — | — | ring burst in the crystal colour, 220 ms; then a ghost outline until it is back | — |
| Headbutt reset returns | — | — (deliberately silent: a world timer every 2.5 s would be noise) | crystal pop-in, back-out 150 ms | — | — | — | — | — |
| Respawn | light | `respawn` | — | — | — | — | blink 8 Hz + ring | — |
| Dive launch | light | `dive-launch` | dive pose | — | — | — | — | — |
| Front hit taken | medium | `hit` / `dive-impact` (gain by knockback) | — | 0.75 | 3 px | — | impact pop (not on dive hits) | kick |
| Roll bounce (hit or dash roll) | medium | `tumble-bounce` | squash wide (by speed) | — | 3 px (by speed) | — | — | kick |
| Dash roll starts (fire held through a dive) | light | `land` soft thud (`crouchGain`) | — | — | — | — | the body spins with its ground speed (sim `rollAngle`) | — |
| Roll comes to rest | light | `land` soft thud (`crouchGain`) | — | — | — | — | the body turns back upright (stand-up) | — |
| Dive wall bonk | medium | `land` + the wall's material sound (gain by speed into the wall) | bonk squash (dive pose) | — | — | — | — | — |
| Back hit taken | heavy | `hit` / `dive-impact` (gain by knockback) | — | 1.0 | 6 px | 50 ms | impact pop (not on dive hits) | kick |
| Explosion | heavy | `explosion` (ducks music) | — | — | 6 px (by radius) | — | star burst | — |
| Terrain destroyed | light | material's sound (`thud` / `crumble` / `thwap` / `clink`) | — | — | — | — | debris | — |
| Torch spray (held) | light | `torch-start`, then the `torch-loop` held while it sprays (pitched by the holder) | — | — | — | — | outlined flame from the nozzle: neck, rolling head, flames peeling off upward, flare at terrain; grows in over 120 ms | — |
| Torch released | light | — (the torch loop fades out over 120 ms) | — | — | — | — | the head lets go as one rising puff, 300 ms | — |
| Freeze ray (held) | light | `freeze-start`, then the `freeze-loop` held while it sprays (pitched by the holder) | — | — | — | — | outlined cold breath from the emitter: neck, rolling head where it lands, snow specks; grows in over 120 ms | — |
| Freeze ray released | light | — (the freeze loop fades out over 120 ms) | — | — | — | — | the head lets go as three rising puffs, 300 ms | — |
| Ground freezing | — | — (the freeze loop covers it; silent per sample) | — | — | — | — | the frozen shape grows from where the breath lands, in the ice colours with a lip and gloss streaks | — |
| Ground thawing | light | `thaw`, at most every 0.5 s, gain by the samples thawed since the last one (`SOUND_MIX.thawFullSamples`); the torch melting it: `steam-hiss` | — | — | — | — | the frozen shape recedes, oldest part first | — |
| Torch held, idle | — | — (a loop, deliberately silent) | — | — | — | — | small outlined flame on the nozzle | — |
| Fire spreading / burning | — | one `fire-crackle` loop for the whole world, gain by burning samples plus burning blobs (`SOUND_MIX.fireFullSamples`; silent per sample) | — | — | — | — | one outlined fire shape per cluster of burning terrain, its flames bigger with more fire around them and tallest in the middle; scorch on earth | — |
| Fire burn-out (batch) | light | `burn-out` via `terrainDestroyed` (fire's own, not the material's), once per 0.25 s batch | — | — | — | — | debris + a white smoke puff, 450 ms | — |
| Fire on a moving part (mover-materials-l2) | as the two rows above | the same `fire-crackle` loop (a part's burning samples count in) and `burn-out` per batch | — | — | — | — | the same fire shape, flames and smoke, drawn in the part's frame so they ride and turn with it; the part's outline and fill are cut where it burnt | — |
| Blob catches fire (fire-burn b2) | light | `catch-fire` (pitched by the blob) | — | — | — | — | amber flame pop (0.6 s linger); then helmet flames, sweat, pinprick pupils while burning | — |
| Burning blob panic (held) | — | — (the catch cue only) | drawn hop every 0.4 s, sx · sy within the band (±0.08) | — | — | — | drawn 5-unit hop; body and shadow stay on the ground | — |
| Fire put out by ice | light | `steam-hiss` (pitched by the blob) | — | — | — | — | white steam puffs (0.6 s) | — |
| Beam clash (torch flame meets freeze ray, held) | light | `steam-hiss` when it starts, then at most every 0.5 s while it holds | — | — | — | — | both beams end at the meeting point; white steam puffs with an ink edge keep rising from it (0.6 s each) | — |
| Frost building on a blob (held ray) | — | — (the ray's start cue) | — | — | — | — | the ice block forms around the blob as the chill fills | — |
| Blob freezes (ice-frozen-blobs) | light | `freeze-solid` (pitched by the blob) | — | — | — | — | white pop ring (250 ms), then the glossy block with pinprick pupils inside | — |
| Ice block cracks (jump press) | light | `ice-crack`, soft (crouch gain, pitched by the blob) | drawn 4-unit hop, 200 ms | — | — | — | a crack line on the block, three ice chips (500 ms) | — |
| Ice block breaks (third press, a hit, time up) | light | `ice-shatter` (pitched by the blob); a hit adds its own `hit` | — | — | — | — | eight ice shards fly off (500 ms) | — |
| Ice block melts (fire) | light | fire's douse `steam-hiss` | — | — | — | — | white steam puffs (500 ms) | — |
| Moving part moves / carries | — | — by default; the author's `data-move-sound` at its fastest point and `data-end-sound` at each turning point (owner B2) | — | — | — | — | — (no motion cue, owner B1) | — |
| Crushed by a moving part | heavy | `land`, then `elimination` (owner B2) | pancake across the squeeze, held 0.15 s (past the band, owner B3); the eyes keep their size and show the panic pupils (owner, squish-eyes) | — (no hit of its own) | 6 px (the back-hit kick) | — | goo stains on both faces, the part's riding along; helmet and tube fly off | pops off |
| Squeezed by a moving part (survivable) | — (no hit) | — (the blob makes no sound; the part may have its own) | squash across the gap to the gap width, stretch along it up to 1.6×, every frame while squeezed; springs back the frame the gap opens (past the band, owner #64 change round); the eyes keep their size and show the burning blob's panic pupils while squeezed (owner, squish-eyes) | — | — | — | — | — |
| Fire blown off by a dive | light | the dive's `dive-launch` | — | — | — | — | ember flames thrown up and out (0.6 s) | — |
| Fire passed by a bump | light | the bump's own cue | — | — | — | — | flame ball arcing to the rival (0.3 s) | — |
| Burn tick (−1 chunk at 1 s, and at 2 s unless crouching) | medium (a `playerHit`) | `hit` via `playerHit` | as a hit | as a hit | as a hit | — | as a hit | as a hit |
| Burning blob goes out (2 s) | — | the second tick's `hit` (none when crouching) | — | — | — | — | grey smoke puffs (0.6 s) | — |
| Elimination (knockout) | heavy | `elimination` (at the elimination, not the burst) | flies with the knockback, then squash `feel.knockout.squash` (the land pose, 100 ms) at the first hard contact; overkill squashes at once | the lethal hit's flash | the lethal hit's shake | — | goo burst: 6 droplets keep the blob's momentum and splat on contact; helmet and tube fly off as solid pieces (knockout feature) | pops off |
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
