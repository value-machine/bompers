# Brief — Player movement and blob feel

Task: Player movement and blob feel · Lap: temp_job_player-movement · Harness: v0.44.0

## Problem

Players move with a placeholder controller (instant run speed, fixed jump, box sprite), so the game has none of the light, bouncy blob feel GDD § 2 asks for.

## Success check

With default tunables, a held run reaches `runSpeed` over a measurable accel ramp (not instantly), a held jump peaks at `jumpSpeed² / (2·gravity)` (and twice as high at half gravity), a jump released early peaks lower, a jump pressed shortly after leaving a ledge (coyote) or shortly before landing (buffer) still fires, and a jump while sliding on a wall launches away from that wall — all asserted by `playerController.test.ts`; the blob renders with body, feet, helmet emblem and squash in a headless Chromium check.

## In scope

- Controller: ground accel / decel / turn boost, air accel (air steering), gravity-scaled jump, variable height (release cut), coyote time, jump buffer, wall-slide (capped fall), wall-jump (push away + brief control lock), unit aim vector (falls back to facing).
- Sim event counters on `PlayerState` (jumps, wall-jumps, landings + impact speed) and `groundBelowY` so the renderer derives squash and the contact shadow without its own sim state.
- Renderer: Gumdrop Pop blob (DESIGN_LANGUAGE § 2–4, § 6): ink outline, body + crescent + gloss, two feet in body shade that deform on landing and lag, cream helmet with emblem ●▲■✚, eyes toward aim, landing / jump / wall-jump squash (area kept), idle breathing, flat contact shadow.
- Tunables: `player` section (+ type).

## Out of scope

- Will NOT do: zoom-scaled stroke widths, helmet spring wobble, rocket tube, hit flash, respawn blink — visual pass / combat / match tasks.
- Will NOT do: rocket jumps (combat lap; knockback = velocity on `PlayerState`).
- Will NOT touch: `stepPlayers` signature, feet-point convention, other features' internals, `app-tasks.json`.

## Edges

| Feature area                        | Loop today                                     | Hook point                                                  | Ride / new                    |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| player                              | match → `stepPlayers` → applyInput/applyMotion | controller internals, `PlayerState`, renderer               | ride — seam made for this lap |
| shared/config gameTunables (+ type) | read by all systems                            | `player` section                                            | ride — own section            |
| shared/config gamePalette           | renderer colours                               | additive keys (ink, helmet, shades, tints, DL player hexes) | ride — told the orchestrator  |
| arena (read only)                   | `rectHitsSolid` via arenaApi                   | wall probe, ground scan                                     | ride                          |

## Size

M — one feature rewritten (controller + renderer) plus two shared config sections; no cleanup beyond replacing the placeholder.
Cut into laps: none

## Decisions

DECISIONS.md D1…D6.
