# Brief — Headbutt reset power-up

Task: Headbutt reset power-up (FEEDBACK_ROUND_2 § 2.3) · Lap: temp_job_headbutt-reset · Orchestrator run `run:bompers-game-2`

## Problem
A blob that spent its one dive per airtime cannot chain headbutts through the air; the owner wants a placeable pickup that restores the dive charge mid-flight (Ori / Celeste style) so levels get air routes and parkour chains.

## Success check
In a sim test, a player whose dive charge is spent (airborne, `charged: false`) touches a `dive-reset` pickup placed on a level collectible point: their charge is `true` that same step, the pickup is gone, a player who still holds their charge passes through it without taking it, and it is back after `collectibles.diveReset.respawnSeconds`.

## In scope
- Catalog item `dive-reset` (label "Headbutt reset", `use: collectible`): placed with the existing `collectible` role, `<circle data-role="collectible" data-item="dive-reset">` — additive, no format bump (LEVEL_FORMAT § 8).
- Collectibles: fixed (non-falling) reset pickups, one per `dive-reset` point, present from match start; touch pickup by the first eligible player; respawn timer; returns `ResetCollected[]`.
- Dive: public `isDiveSpent(dive, player)` and `refillDive(dive, player)` (charge back; phase and cooldown untouched; bumps a `refillCount` for the sound cue).
- Match: step the reset pickups after dives (step 4, beside orbs), passing only players whose charge is spent; hand results to `refillDive`; render layer.
- Look: own shape and colour (DESIGN_LANGUAGE § 1 Effects row), ghost outline while respawning, pop-in on return, burst on collect.
- Juice: ledger rows (GAME_JUICE § 6) — collect = `light` tier, sound `pickup` reused (pitched by the collector); respawn = visual pop only.
- Level kit + docs: `pnpm level-kit:sync` (catalog.json + ID table), AUTHORING.md, LEVEL_FORMAT § 6 note, preview kit colour for the item, placed in both shipped levels (`start-arena`, `floating-garden`) where an air route makes sense.
- Tunables `collectibles.diveReset` (`respawnSeconds`, `size`).

## Out of scope
- Will NOT do: a new sound file (reuse `pickup`; new audio needs the owner's listen-first, DESIGN_LANGUAGE § 8) — deferred.
- Will NOT do: a HUD/body cue for "charge ready" on the player — deferred.
- Will NOT do: the point-orb pickup sound gap (orbs make no sound today) — not this lap.
- Will NOT touch: dive phases, cooldown, ricochet, one-dive-per-airtime rule; point-orb schedule; weapon crates; level format version.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| content-catalog | items rocket-launcher, homing-launcher, point-orb | `CONTENT_CATALOG.item` | ride — one entry |
| collectibles | orbs (sky schedule) + crates | new `diveResets.ts` service + state slice + renderer layer | ride — new pickup kind beside orbs |
| dive | `charged` back on ground / hit | `refillDive`, `isDiveSpent` in `diveApi` | ride — two small exports |
| match | gameSim step 4, renderer layers, sound snapshot | step 4 call, render frame, `diveRefillCount` in snapshot | ride |
| sound | cues from snapshot counters | `soundCues.ts` cue `pickup` on refill count rise | ride |
| level-file / level kit | collectible role accepts any `use: collectible` item | catalog.json, AUTHORING.md, preview.js/css | ride |
| shared config | `gameTunables.collectibles`, `gamePalette` | `collectibles.diveReset`, `gamePalette.diveReset` | ride |
| public/levels | 2 shipped levels | add `dive-reset` points | ride |
| docs | LEVEL_FORMAT, GAME_JUICE, DESIGN_LANGUAGE, feature READMEs | rows / notes | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — nine edges, each a small ride; no refactor needed.
Cut into laps: none.

## Decisions
DECISIONS.md D1–D6.
