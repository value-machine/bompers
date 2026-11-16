# dive

## Purpose

The unarmed attack (GDD § 3 "Ongewapende aanval", the "bomp"): fire makes a blob dive headfirst along its aim, a committed straight missile; hitting another blob knocks it away and ricochets the attacker up with the dive ready again. Owns the dive state machine, the strike and the ricochet; damage, health and spawn protection are combat's. Design and numbers: `documentation/jobs/temp_job_dive-headbutt/DIVE_DESIGN.md`.

## Structure

| Layer    | Path                       | Purpose |
| -------- | -------------------------- | ------- |
| Types    | `types/dive.types.ts`      | `DiveState` (slice of `GameState`), `DiveMotion` per player, `DiveHit` (combat's `Hit` + its result + the impulse) |
| Services | `services/diveSim.ts`      | `stepDives({ dive, players, combat, contacts, tunables, timeSeconds, dt })` → this step's `DiveHit[]` (sim step 3b); `requestDive` (a fire press), `resetDive` (respawn), `createDiveState`. Phases: idle → wind-up → travel → recovery |
| Services | `services/divePose.ts`     | Pure render pose per phase (crouch, launch stretch, ricochet squash, bonk squash, hit squash) as a `BlobPoseOverlay` |
| Services | `services/diveRenderer.ts` | Impact pops (world effects layer) and `diveBlobPoses` for the player layer |
| API      | `api/diveApi.ts`           | Public seam |

## How it works

- **Dive:** 12 frames of wind-up (hang, crouch, direction locked, 8-way), then up to 30 frames dead straight at 900 units / s with no gravity, no steering and no cancel. One dive per airtime.
- The dive **never moves a player**. It writes velocity at events (launch, bonk, strike) and the controller's motion modifiers (`steerScale`, `gravityScale`, `jumpLocked`) every step; `stepPlayers` does all movement and terrain collision, so a dive cannot tunnel.
- A **hit** = a `BodyContact` from `resolveBodyContacts` (player feature) where the attacker is travelling toward the other at `dive.minHitSpeed` or more. The body collision has already exchanged the momentum; the dive adds the strike on the victim (push + upward pop + a short steering stagger) and the **ricochet** on the attacker (pops straight up, dive ready again at once).
- **Hurt reaction:** the strike calls the player feature's `reactToHit` with the impulse it gave. A hard hit (impulse at least `tumble.minImpulse`, or any back hit) sends the victim into a tumble: it ricochets off floors and walls. A tumbling blob cannot start a dive. The attacker itself never bounces off terrain.
- **Terrain always ends the dive and never bounces it:** head-on is a bonk (small hop back, short stun), a glancing touch a plain recovery.
- **Combat:** the dive starts from combat's `unarmedAttack` hook (match passes `requestDive`), so it only fires for an unarmed, non-eliminated player, once per press. Every strike goes through combat's `applyHit` with `kind: "contact"`, `source: "dive"`: zone, damage (`combat.hitDamage.contact`), spawn protection, kill credit and the `playerHit` event are combat's. A spawn-protected victim is still bounced (`landed: false`, no damage). The knockback, ricochet and cooldown are the dive's.

## Dependencies

- `combat` via `api/combatApi.ts` (`applyHit`, `CombatState`); `diveSim.test.ts` steps combat too (`createCombatState()`, `stepCombat` without crates — those moved to `collectibles`).
- `player` via `api/playerApi.ts` (`PlayerState`, `BodyContact`, `BlobPoseOverlay`, `reactToHit`, `isTumbling`).
- Shared: `gameTunables` (`dive` section), `gamePalette`, `gameInput.types`, `gameInputMapping`, `gameGeometry.types`; `pixi.js` in the renderer.
- Consumed by `match` only.

## Decisions

- Blob-vs-blob collision lives in `player`, not here: it applies with no dive at all (dive-headbutt D1).
- The dive steers the controller through three generic modifiers on `PlayerState`; the player feature knows nothing about dives (dive-headbutt D2).
- Owner's pick after the three-option prototype (dive-headbutt D8): Cannonball's launch, Pogo's ricochet off other blobs, no bounce off terrain.
- A head-on clash has no special rule: both reflect equally, both ricochet and both take the front-zone damage (dive-headbutt D6). Ricochets are applied before pushes so the result does not depend on player order.
- One dive per airtime; the charge returns on ground contact or on a hit (dive-headbutt D7).
- A wall bonk stuns for 30 frames (250 ms), down from the prototype's 54, to stay fair (dive-headbutt D9).
- Test levels list terrain as `{ shape, materialId }` only: terrain has no role since level format 2 (material-system D5).
