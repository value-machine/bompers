# Brief — Combat: hit API, rocket launcher and explosions

Task: Combat health, hit API, rocket launcher and explosions (renamed after the owner's scope change, D10–D11) · Lap: temp_job_combat · Harness: v0.44.0

## Problem

Players can move but cannot hurt each other: no health, no attack, no weapon, no explosions, no destructible terrain in play (GDD § 2 Rocket Jumping, § 3).

## Success check

With default tunables, `combatSim.test.ts` asserts: a rocket explosion removes exactly 1 chunk from every other player in range and none from the shooter; the impulse points away from the blast and weakens with distance; a rocket fired straight down from standing lifts the shooter higher than a full jump; a rocket at max speed never passes through a 1-cell wall or a player; a blast clears only destructible cells and emits the material's effect / sound IDs; `applyHit` classifies front / back from the victim's facing and takes the damage from the `hitDamage` table (contact 1 / 2, blast 1 / 1; 0 = bounce); unarmed fire does nothing but call the `unarmedAttack` hook; a dropped launcher falls, lands on terrain, is picked up on touch, and its ammo runs out; a player with `invulnerableUntil` in the future takes no damage. A headless Chromium run shows pickup, rocket jump, a crater in a dirt plateau and a hit on the other player.

## In scope

- New `features/combat` (sim step 3): per-player fighter state (4 health chunks, cooldowns, weapon + ammo, `invulnerableUntil`, last hitter), rockets, pickups, typed sim events (`playerHit`, `playerEliminated`, `rocketFired`, `explosion`, `terrainDestroyed`, `pickupSpawned`, `pickupCollected`).
- Shared hit / damage API `applyHit` (zones, damage table in tunables, protection, events) used by rockets and the dive lap; unarmed fire → an `unarmedAttack` hook only. Rocket launcher pickup from level drop points (falls, lands, touch to take), rockets (helmet origin, unit aim, swept sub-steps), explosion (damage others, radial impulse to all, `clearCircle`, material effect / sound IDs).
- Elimination at 0 → event, then the engine's step-4 respawn (health refilled, weapon dropped). Falling out of bounds also emits `playerEliminated` (cause `out-of-bounds`, credit = last hitter within a window).
- Render layer per DESIGN_LANGUAGE § 1, § 5: pickups, explosion starburst, rockets (+ rocket tube on armed players), 4-chunk health pips above each player; FX under player outlines.
- Tunables `combat` section; palette effect colours; arena `clearCircle` reports removed cells per material.

## Out of scope

- Will NOT do: any unarmed attack (dive headbutt lap); scoring, respawn point choice, setting `invulnerableUntil`, respawn blink (match-rules lap); sound playback (sound lap); HUD cards (HUD lap); hit flash, screen shake, debris, zoom-scaled strokes (visual pass).
- Will NOT touch: `stepPlayers` signature, `app-tasks.json`, the content catalog entries.

## Edges

| Feature area                   | Loop today                           | Hook point                                                     | Ride / new                |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------- | ------------------------- |
| combat                         | —                                    | `stepCombat` (sim step 3), combat view                         | new                       |
| match                          | `stepGame` steps 1–5, `gameRenderer` | `combat` slice, step 3 call, step 4 respawn via combat, layers | ride — seam made for this |
| arena                          | `clearCircle` returns a count        | return `{ removed, byMaterial }`                               | ride — small API change   |
| player (read / write velocity) | `PlayerState`                        | `vx`/`vy` impulses, `playerBody`, `aimX`/`aimY`                | ride                      |
| shared config                  | tunables, palette                    | `combat` section; effect colours                               | ride — own section        |

## Size

M — one new feature (sim + renderer), match wiring, a one-function arena change, two shared config sections.
Cut into laps: none

## Decisions

DECISIONS.md D1…D11.
