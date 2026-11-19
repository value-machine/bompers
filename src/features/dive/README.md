# dive

## Purpose

The headbutt (GDD § 3 "Ongewapende aanval", the "bomp"): fire (unarmed) or a mid-air jump press (anyone, armed too) makes a blob dive headfirst along its aim, a committed straight missile; hitting another blob knocks it away and ricochets the attacker up with the dive ready again. Owns the dive state machine, the strike and the ricochet; damage, health and spawn protection are combat's. Design and numbers: `documentation/jobs/temp_job_dive-headbutt/DIVE_DESIGN.md`.

## Structure

| Layer    | Path                       | Purpose                                                                                                                                                                                                                                 |
| -------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/dive.types.ts`      | `DiveState` (slice of `GameState`), `DiveMotion` per player, `DiveHit` (combat's `Hit` + its result + the impulse)                                                                                                                      |
| Services | `services/diveSim.ts`      | `stepDives({ dive, players, combat, contacts, tunables, timeSeconds, dt })` → this step's `DiveHit[]` (sim step 3b); `requestDive` (a fire press), `resetDive` (respawn), `createDiveState`. Phases: idle → wind-up → travel → recovery |
| Services | `services/divePose.ts`     | Pure render pose per phase (crouch, launch stretch, ricochet squash, bonk squash, hit squash) as a `BlobPoseOverlay`                                                                                                                    |
| Services | `services/diveRenderer.ts` | Impact pops (world effects layer) and `diveBlobPoses` for the player layer                                                                                                                                                              |
| API      | `api/diveApi.ts`           | Public seam                                                                                                                                                                                                                             |

## How it works

- **Dive:** 12 frames of wind-up (hang, crouch, direction locked, 16-way: 22.5° steps), then up to 30 frames dead straight at 900 units / s with no gravity, no steering and no cancel. One dive per airtime.
- The dive **never moves a player**. It writes velocity at events (launch, bonk, strike) and the controller's motion modifiers (`steerScale`, `gravityScale`, `jumpLocked`) every step; `stepPlayers` does all movement and terrain collision, so a dive cannot tunnel.
- A **hit** = a `BodyContact` from `resolveBodyContacts` (player feature) where the attacker is travelling toward the other at `dive.minHitSpeed` or more. The body collision has already exchanged the momentum; the dive owns the hit's knockback: the victim is pushed away from the impact exactly like a direct rocket hit (`directHitPush` from `shared/utils/blastPower.ts`, ≈ 570 units/s; owner, bash-matches-rocket lap), added to how it was moving, except that a victim the collision bounced back (a head-on clash) keeps that bounce up to the push; plus a short steering stagger and the **ricochet** on the attacker (pops straight up, dive ready again at once).
- **Hurt reaction:** the strike calls the player feature's `reactToHit` with the impulse it gave: the victim rolls as long as the impulse says, the same rule as a blast victim (the back-hit minimum lock is gone, bash-matches-rocket lap; a back hit still deals more damage). A blob in a hit roll that is still locked cannot start a dive; an unlocked roll can, and the dive ends it (double-jump-bash D12). The attacker itself never bounces off terrain.
- **Dash-hold roll (shared-roll D1, D2):** a dive whose travel ends (time-out or a glancing terrain touch) while the button that started it (fire, or jump for a jump dive) is still held rolls on at full dive speed in the player feature's roll (`startRoll`, source `dash`) instead of recovering; the dive goes idle with its cooldown. Letting go of fire ends the roll. `stepDives` reads fire from its optional `inputs`. Each dash roll start counts in `PlayerState.moveRollCount` (shared with the crouch roll, crouch-roll R4; was `dashRollCount`).
- **Terrain always ends the dive and never bounces it:** head-on is a bonk (small hop back, short stun), a glancing touch a plain recovery (or the dash roll while fire is held).
- **Combat:** the dive starts from combat's `unarmedAttack` hook (match passes `requestDive`), so it only fires for an unarmed, non-eliminated player, once per press. Every strike goes through combat's `applyHit` with `kind: "contact"`, `source: "dive"`: zone, damage (`combat.hitDamage.contact`), spawn protection, kill credit and the `playerHit` event are combat's. A spawn-protected victim is still bounced (`landed: false`, no damage). The knockback, ricochet and cooldown are the dive's.
- **Jump dive (owner, double-jump-bash D1–D5, D17):** a mid-air jump press is the dive's second input, so armed players can headbutt too. The player controller counts an air press it did not use (no ground, coyote or wall jump, no ground near enough for the landing buffer) in `airJumpPressCount`; `stepDives` reads each rise (`DiveState.airJumpPressesRead`) as a request that starts now, in the air, or is dropped (never buffered, so a landing jump never turns into a ground dive). Same 16-way aim, strike, ricochet, cooldown and one shared charge per airtime as a fire dive; with no aim input a jump dive goes straight up (a bashing double jump), a fire dive along facing. Each dive keeps its `trigger`, whose button holds the dash roll.
- **Roll carry (owner, double-jump-bash D12, D13):** a dive out of a roll launches at `max(launchSpeed, min(roll speed along the aim, dive.rollCarryMax))`, read before the wind-up slows the blob (`DiveMotion.launchSpeed`); travel time stays the same, so it reaches up to 288 units instead of 225. Falls and blasts never feed it.

## Dependencies

- `combat` via `api/combatApi.ts` (`applyHit`, `CombatState`); `diveSim.test.ts` steps combat too (`createCombatState()`, `stepCombat` without crates — those moved to `collectibles`).
- `player` via `api/playerApi.ts` (`PlayerState`, `BodyContact`, `reactToHit`, `startRoll`, `isRolling`); `blob-look` via `api/blobLookApi.ts` (`BlobPoseOverlay`).
- Shared: `gameTunables` (`dive` section), `gamePalette`, `gameInput.types`, `gameInputMapping`, `gameGeometry.types`; `pixi.js` in the renderer.
- Consumed by `match` only.

## Decisions

- Blob-vs-blob collision lives in `player`, not here: it applies with no dive at all (dive-headbutt D1).
- The dive steers the controller through three generic modifiers on `PlayerState`; the player feature knows nothing about dives (dive-headbutt D2).
- Owner's pick after the three-option prototype (dive-headbutt D8): Cannonball's launch, Pogo's ricochet off other blobs, no bounce off terrain.
- A head-on clash has no special rule: both reflect equally, both ricochet and both take the front-zone damage (dive-headbutt D6). Ricochets are applied before pushes so the result does not depend on player order.
- One dive per airtime; the charge returns on ground contact or on a hit (dive-headbutt D7), or from a headbutt reset pickup: `refillDive` (match calls it; `isDiveSpent` = airborne and uncharged).
- A refill also waives the between-dives cooldown: the next dive is ready once the current recovery ends, so chains through several resets work. Without it a link cost 0.7 s of free fall (headbutt-reset D4). The refill count lives in `DiveState.refillCounts` (not the motion) so respawns never make it go back; sound cues `pickup` on its rise.
- A wall bonk stuns for 30 frames (250 ms), down from the prototype's 54, to stay fair (dive-headbutt D9).
- Test levels list terrain as `{ shape, materialId }` only: terrain has no role since level format 2 (material-system D5).
- The dive aim snaps to 16 directions (22.5°), up from 8, for finer headbutt aim. Keyboard aim (four direction keys) still only reaches the 8 main ones; sticks reach all 16. The owner accepted that keyboard players don't get the in-between angles (dive-16-ways D1, 2026-11-16).
- The back-out and quad eases come from `shared/utils/easing.ts` (pickup-juice D5: four copies of the back-out ease extracted).
