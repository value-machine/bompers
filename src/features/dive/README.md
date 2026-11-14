# dive

## Purpose

The unarmed attack (GDD § 3 "Ongewapende aanval", the "bomp"): fire makes a blob dive headfirst along its aim; a body contact made while diving is a hit that knocks the other blob away. Owns the dive state machine, hit zones, damage per zone and the typed hit events. Health is not here: combat consumes the hits.

**Phase 1 (v0.44.0):** three candidate dives are in the build (`documentation/jobs/temp_job_dive-headbutt/DIVE_OPTIONS.md`), switched with keys 1 / 2 / 3. Phase 2 keeps the owner's pick and deletes the other two tunable sets and the switch.

## Structure

| Layer    | Path                       | Purpose |
| -------- | -------------------------- | ------- |
| Types    | `types/dive.types.ts`      | `DiveState` (slice of `GameState`), `DiveMotion` per player, `DiveHit`, `HitZone`, `HitTally` |
| Services | `services/diveSim.ts`      | `stepDives({ dive, players, inputs, contacts, tunables, dt })` → this step's `DiveHit[]` (sim step 3a); `createDiveState`, `selectDiveOption`, `activeDiveOption`. Phases: idle → wind-up → travel → recovery |
| Services | `services/hitZone.ts`      | `classifyHitZone(victimFacing, direction)` (same rule and signature as combat's), `hitDamage(zone, tunables)` |
| Services | `services/divePose.ts`     | Pure render pose per phase (crouch, headfirst turn + stretch, bonk squash, hit squash) as a `BlobPoseOverlay` |
| Services | `services/diveRenderer.ts` | Impact rings (world effects layer), `diveBlobPoses` for the player layer, the prototype overlay text |
| API      | `api/diveApi.ts`           | Public seam |

## How it works

- The dive **never moves a player**. It writes velocity at events (launch, terrain bounce, strike) and the controller's motion modifiers (`steerScale`, `gravityScale`, `jumpLocked`) every step; `stepPlayers` does all movement and terrain collision, so a dive cannot tunnel.
- A **hit** = a `BodyContact` from `resolveBodyContacts` (player feature) where the attacker is in the travel phase and moves toward the other at `dive.minHitSpeed` or more. The body collision has already exchanged the momentum; the dive adds the option's strike. One hit per victim per dive.
- **Seam to combat:** `stepDives` returns the step's hits and keeps them in `DiveState.hits`. `features/match/services/gameSim.ts` step 3a is where combat's `applyHit(world, hit)` plugs in: a `DiveHit` already carries its `Hit` fields, and `zone` / `damage` then come from its result. In phase 2 the dive also starts from combat's `unarmedAttack` hook, and `hitZone.ts` plus the two damage tunables are deleted in favour of combat's. Until then `DiveState.tallies` counts hits for the overlay.
- A variant is one `DiveOptionTunables` set in `gameTunables.dive.options`; there is a single code path.

## Dependencies

- `player` via `api/playerApi.ts` (`PlayerState`, `BodyContact`, `BlobPoseOverlay`).
- Shared: `gameTunables` (`dive` section), `gamePalette`, `gameInput.types`, `gameInputMapping`, `gameGeometry.types`; `pixi.js` in the renderer.
- Consumed by `match` only.

## Decisions

- Blob-vs-blob collision lives in `player`, not here: it applies with no dive at all (dive-headbutt D1).
- The dive steers the controller through three generic modifiers on `PlayerState`; the player feature knows nothing about dives (dive-headbutt D2).
- One state machine, options as data (dive-headbutt D3).
- A head-on clash has no special rule: both reflect and both take the front-zone damage (dive-headbutt D6).
- One dive per airtime; the charge returns on ground contact, or on a hit for an option with `refreshOnHit` (dive-headbutt D7).
