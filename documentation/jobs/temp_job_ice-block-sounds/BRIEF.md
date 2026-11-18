# Brief: Ice block sounds

Task: "Ice block sounds" · Lap: temp_job_ice-block-sounds · Branch: `claude/ice-block-sounds`

## Problem
The frozen-blob ice block (#69) plays `clink` placeholders (ice-frozen-blobs D2) for three moments: a blob freezing solid, a jump press cracking its block, the block breaking. Each should sound like ice.

## Success check
On the PR preview, freezing a blob, pressing jump inside the block and breaking out (or diving into a frozen blob) each play the take the owner picked on the listening page; the melt keeps fire's `steam-hiss`; nothing is wired that the owner did not approve there.

## Moments

Family "Element" (DESIGN_LANGUAGE § 8). Template as in element-sounds: material + action + palette words + "close-mic, dry, cartoon sound effect"; `eleven_text_to_sound_v2`, `prompt_influence` 0.6, `duration_seconds` 0.5; no "toy".

| # | Moment | Now | New ID | Prompt | Len | Takes |
|---|--------|-----|--------|--------|-----|-------|
| 1 | Blob freezes | `clink` | `freeze-solid` | Water snap-freezing into an ice block, a quick crystalline crackle that locks shut with a glassy "tink", cool and plinky, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 2 | Ice block cracks (each jump press, gain `crouchGain`) | `clink`, soft | `ice-crack` | Small ice block cracking under a tap, a short sharp glassy "crick" with a tiny creak, cool and plinky, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 3 | Ice block breaks (third press, a dive hit, time up) | `clink` | `ice-shatter` | Ice block shattering into bright shards, a crisp glassy smash with tinkling pieces scattering, cool and plinky, close-mic, dry, cartoon sound effect | 0.5 s | 4 |
| 4 | Ice block melts (fire) | `steam-hiss` | keep | — | — | — |

Totals: 3 new sounds, 12 takes.

## In scope
- Generation, processing per DESIGN_LANGUAGE § 8 (trim, 0.5 s with 60 ms fade-out, −16 LUFS, limiter, mono 96 kbps mp3), one listening page with the takes and the `clink` placeholder, a recommendation per sound.
- After the picks: files in `public/audio/sfx/`, catalog sound IDs, bank entries, the three cues in `soundCues.ts`, GAME_JUICE rows, § 8 line.

## Out of scope
- Will NOT do: sim or look changes to the ice block, the melt sound, other ice sounds.

## Edges
| Feature area | Hook point | Ride / new |
|---|---|---|
| sound | bank, cues | ride |
| content-catalog | new sound IDs | ride |
| public/audio/sfx, documentation/game | files, § 8, ledger | ride |

## Size
XS: three ride-along cues; most of the lap is generation and listening.
