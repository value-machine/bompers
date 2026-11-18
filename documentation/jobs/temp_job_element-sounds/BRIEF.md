# Brief: Fire, torch and ice sounds

Tasks: "Fire and torch sounds" + "Ice lap 3: ice sounds" · Lap: temp_job_element-sounds · Branch: `claude/element-sounds`

## Problem
Fire (#53/#55/#56/#58) and the freeze ray (#63) play placeholders: the torch start and a blob catching fire play `rocket-fire`, the freeze ray start and ice dousing a blob play `clink`, and a held spray, a burning fire, freezing and thawing make no sound. Each element should sound like itself.

## Success check
On the PR preview, every moment in the table below plays the take the owner picked on the listening page (or the reuse it names); held sprays and burning fires loop while they last and fade out when they stop; nothing is wired that the owner did not approve there.

## Moments

Family "Element" (new row in DESIGN_LANGUAGE § 8 once picked). Template: material + action + palette words + "close-mic, dry, cartoon sound effect"; `eleven_text_to_sound_v2`, `prompt_influence` 0.6; no "toy".

| # | Moment | Now | Plan | New ID | Prompt (draft) | Len | Takes |
|---|--------|-----|------|--------|----------------|-----|-------|
| 1 | Torch spray starts | `rocket-fire` | new | `torch-start` | Soft gas burner catching with a round "fwoomp", puffy and warm, short flame whoosh, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 2 | Torch spray held | silent | new loop | `torch-loop` | Steady soft blowtorch roar with gentle flutter, warm and puffy, no hiss spikes, seamless loop, close-mic, dry, cartoon sound effect | 2 s loop | 3 |
| 3 | Torch released | silent | loop fades out (120 ms); no file | — | — | — | — |
| 4 | Terrain catches fire | silent | covered by #5 fading in | — | — | — | — |
| 5 | Fire burning (world) | silent | new loop, gain by burning samples | `fire-crackle` | Cosy campfire crackle, papery pops and soft flutter of flames, bright and friendly, seamless loop, close-mic, dry, cartoon sound effect | 3 s loop | 3 |
| 6 | Fire burn-out (batch) | `thwap` | new, `thwap` kept as candidate | `burn-out` | Burnt cardboard crumbling into ash with a soft papery collapse and a tiny sizzle, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 7 | Blob catches fire (also by a bump) | `rocket-fire` | new, pitched by victim | `catch-fire` | Gel blob bursting into flame, quick bright "fwoosh" with a jelly wobble, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 8 | Burning blob (2 s) | silent | counts into #5's gain | — | — | — | — |
| 9 | Burn tick / goes out | `hit` | keep | — | — | — | — |
| 10 | Fire blown off by a dive | `dive-launch` | keep | — | — | — | — |
| 11 | Ice puts out a burning blob | `clink` | new | `steam-hiss` | Water drop on a hot pan, quick soft steam "tssss" puff, gentle not harsh, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 12 | Fire meets ice (freezing burning ground, torch thawing frozen ground) | silent | `steam-hiss`, rate-limited | — | — | — | — |
| 13 | Freeze ray starts | `clink` | new | `freeze-start` | Frosty air burst with a glassy shimmer, cool crystal "fshing", plinky, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 14 | Freeze ray held (and ground freezing) | silent | new loop | `freeze-loop` | Steady cold breath hiss with tiny ice crystals tinkling as they form, cool and plinky, seamless loop, close-mic, dry, cartoon sound effect | 2 s loop | 3 |
| 15 | Freeze ray released | silent | loop fades out (120 ms); no file | — | — | — | — |
| 16 | Ground thawing | silent | new, at most every 0.5 s, gain by thawed samples | `thaw` | Melting ice block, soft wet drip and a small creak, cool and plinky, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 17 | Frozen blobs (ice lap 2) | — | open: the ice-frozen-blobs thread adds rows | — | — | — | — |

Totals: 9 new sounds, 33 takes (6 short × 4, 3 loops × 3). Loops are generated with the SFX loop option, cut to a whole length with 10–20 ms edge fades and played with a loop toggle on the page.

## In scope
- Generation, post-processing per DESIGN_LANGUAGE § 8, one listening page with takes per moment (loops with a loop toggle, current placeholder for comparison) and a recommendation.
- After the picks: files in `public/audio/sfx/`, catalog sound IDs, bank entries, cues from sim state (counts / versions read by the match, game-sound D2), a looping voice in the audio engine for held sprays and the fire bed, gains by intensity (`intensityGain`), GAME_JUICE ledger rows, § 8 row.

## Out of scope
- Will NOT do: frozen-blob moments (ice lap 2), sim or look changes to fire / ice, music.

## Edges
| Feature area | Hook point | Ride / new |
|---|---|---|
| sound | cues, bank, engine loop voices | ride |
| fire / ice | read-only (state the match snapshots) | ride |
| match | `matchSound.ts` snapshot fields | ride |
| content-catalog | new sound IDs | ride |
| public/audio/sfx, documentation/game | files, § 8, ledger | ride |

## Size
S–M: one new engine capability (loop voices), the rest rides existing seams; most of the lap is generation and listening.
