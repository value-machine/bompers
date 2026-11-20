# Brief — hurt-feedback

Source: owner request "the juice improvement of getting hurt, so players always know when they are hurt". Size: **S–M** (render, sound cue and tunables only; no sim change).

## Problem

Audit on main (b981eb8): every damage path goes through combat `applyHit` → `playerHit`. A burn tick has no push, so its hit sound played at ≈ 0.35 (gain by knockback) and its flash hid under the flames. A crouched hit that takes 0 chunks still flashed, shook, popped and played `hit`, so it looked like a hurt. A back hit (2 chunks) popped only one HUD pip. The blob itself had no hurt pose or face, and nothing marked low health.

## Success check

- Every hit that takes a chunk, from any source, plays its hit sound at ≥ 0.8, flashes 70 ms + 150 ms fade, squashes the blob wide (1.2 × 0.83, back in 150 ms) and shuts its eyes for 200 ms, even while burning or diving.
- One player-coloured chunk per damage point flies off (450 ms); the over-head bar pops 2× and settles (600 ms); every lost HUD pip pops.
- A crouched 0-damage hit: no flash, shake, hit-stop, impact pop or hurt pose; a grey ring and a soft `clink` (0.3).
- At 1 chunk left the blob's outline pulses in its colour (1.2 s loop) and it sweats, until it heals or is out.

## In scope

`gameJuice` (`hurtMinGain`, `hurtGain`), `feel.hurt` tunables + types, `effects` (feel cues skip blocked hits, `hurtPose.ts`, chunks and blocked ring), `blob-look` (`eyesShut` overlay, `drawShutEye`), `combat` (bar pop, low-health layer), `dive` (no pop on a blocked hit), `match` (overlay merge, layer order, HUD pops), `sound` (hurt floor, blocked clink), GAME_JUICE ledger, DESIGN_LANGUAGE § 6 hit line.

## Out of scope

New sounds (owner Q2: no ouch squeak, no credits), sim or damage rules, screen-edge cues.

## Juice table

| Moment                 | Tier      | Sound                       | Visual                                                   | Windows                                                     |
| ---------------------- | --------- | --------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| Hurt (any chunk lost)  | the hit's | `hit` / `dive-impact` ≥ 0.8 | flash, hurt squash, shut eyes, chunks, bar pop, HUD pips | squash 150 / 200 ms, flash 70 + 150 ms, linger 450 / 600 ms |
| Hit blocked (0 chunks) | light     | `clink` at 0.3              | grey ring 220 ms                                         | effect                                                      |
| Low health (state)     | —         | silent                      | outline pulse + sweat, 1.2 s loop                        | loop                                                        |

## Plan

1. Scale + tunables: `hurtGain`, `feel.hurt`, flash hold / fade; extend `gameJuice.test.ts`.
2. Cues: `feelCues` returns early for `damage` 0 and stores `damage`; `soundCues` hit cue (floor / clink); tests.
3. Pose: `hurtPose.ts` (+ test) → match merges it over the other overlays; blob-look shut eyes.
4. Effects: chunks + blocked ring; dive pop hidden on a blocked hit.
5. Combat bar pop + low-health layer under players; HUD pops every lost pip.
6. Docs: ledger rows, § 3 examples, § 5 hurt floor, READMEs.
