# combat

## Purpose

Fighting (GDD § 2 Rocket Jumping, § 3): four health chunks per player, the shared hit / damage API (front / back zones, damage from tunables), the unarmed-attack hook, the rocket launcher (its crates drop in the `collectibles` feature; combat arms whoever takes one), rockets, explosions (damage to others, impulse to everyone, craters), the spawn-protection hook, and the typed sim events other systems read. Runs as sim step 3 in `match`.

## Structure

| Layer    | Path                         | Purpose                                                                                                                                                                                                                                                                                                                                                                                      |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/combat.types.ts`      | `CombatState` (`fighters` by player id, `rockets`, `events`), `FighterState` (`health`, `eliminated`, `invulnerableUntil`, `weapon`, cooldown, last hitter), `CombatEvent` union                                                                                                                                                                                   |
| Services | `services/combatSim.ts`      | `stepCombat({ combat, players, inputs, terrain, bounds, tunables, timeSeconds, dt })`: prune events → fighters → attacks → rockets                                                                                                                                                                                                                                          |
| Services | `services/combatState.ts`    | `createCombatState`, event log (`emitCombatEvent`, prune), `fighterFor`, `eliminateFighter` (out of bounds, kill credit), `respawnFighter`, `CombatContext`; **hits:** `applyHit(world, hit)`, the one damage path — `classifyHitZone(facing, direction)` → front / back, damage from `combat.hitDamage[kind][zone]`, spawn protection, last hitter, `playerHit` / `playerEliminated` events |
| Services | `services/attacks.ts`        | Fire button per press: armed → `fireRocket` + cooldown; unarmed → the optional `unarmedAttack` hook (`UnarmedAttackHook`; match passes the dive's `requestDive`; without it unarmed fire does nothing)                                                                                                                                                                                       |
| Services | `services/rockets.ts`        | Rockets from the helmet along the unit aim; swept sub-steps ≤ half a cell; explode on terrain, another player, bounds or lifetime                                                                                                                                                                                                                                                            |
| Services | `services/explosions.ts`     | `explode`: a `blast` hit through `applyHit` on every other player in range, radial impulse with linear falloff on everyone (shooter too), `clearCircle` crater, `terrainDestroyed` events with the material's catalog effect / sound                                                                                                                                                         |
| Services | `services/weaponPickups.ts`  | `takeWeaponPickups(world, { spawned, collected })`: match hands it the weapon-crate step result from `collectibles`; emits `pickupSpawned`, arms each collector with full ammo, emits `pickupCollected`                                                                                                                                                                                      |
| Services | `services/combatGeometry.ts` | Body centre, helmet point, rect distance / overlap helpers                                                                                                                                                                                                                                                                                                                                   |
| Services | `services/combatRenderer.ts` | Layers `shadows` (contact shadows of rockets, shared `contactShadowLayer`), `rockets` (mockup-E rocket with smoke trail), `overlay` (health chunks above each player); zoom-clamped prop outline; `syncCombatView(view, frame)`                                                                                                                                                   |
| API      | `api/combatApi.ts`           | Public seam (also `CombatContext` and `FighterState` for the `unarmedAttack` hook)                                                                                                                                                                                                                                                                                                           |

Seams for later work:

- **Match rules:** set `FighterState.invulnerableUntil` (sim seconds) on respawn; replace match step 4; read `playerHit` / `playerEliminated` from `combat.events` (each consumer remembers the last `seq` it read; events live `eventRetentionSeconds`).
- **Dive** (`features/dive`): match passes its `requestDive` as `unarmedAttack`; the dive deals damage with `applyHit({ kind: "contact", source: "dive", contactPoint, direction })`; knockback is its own.
- **Hurt reaction:** an explosion calls the player feature's `reactToHit` with the impulse it gave each other player; a close blast (impulse at least `tumble.minImpulse`) sends the victim tumbling off floors and walls. The shooter is only pushed, never tumbled, so rocket jumps stay in control (dive-headbutt D10).
- **Sound:** event `type` → SFX (`rocketFired`, `explosion`, `playerHit`, `playerEliminated`, `pickupCollected`); `terrainDestroyed.soundId` / `effectId` come from the catalog material.
- **Effects:** explosion, impact pop and debris live in the `effects` feature (reads `combat.events`). The rocket tube is drawn by the player renderer, as part of the blob's silhouette.
- **More items:** a new `HeldWeapon.itemId` + its attack in `attacks.ts`; its crate drops in `collectibles` (combat D2: pickups moved there).
- **Tuning:** every number (also the crate drop schedule, `combat.drops`, read by `collectibles`) is in the `combat` section of `src/shared/config/gameTunables.ts`.

## Dependencies

- `player` (`PlayerState`, `playerBody`), `arena` (`clearCircle`, `isSolidAt`, `rectHitsSolid`), `level` (`LevelDrop`), `content-catalog` (material effect / sound) through their `api/` files.
- `pixi.js` (renderer only), `gameTunables`, `gamePalette`, shared geometry / input types.
- Consumed by `match` (state slice, step 3, step 4 hooks, render layers).

## Decisions

- Combat state is a `GameState.combat` slice keyed by player id; `PlayerState` only carries motion (combat D1).
- Events carry a monotonic `seq` and are pruned by age, so several sim steps per frame never hide one (combat D3).
- Elimination flags the fighter; match step 4 does the respawn (combat D4).
- Launcher: 6 rockets, no time limit, dropped when empty or on elimination (combat D5).
- Drops: first after 3 s, then every 7 s while fewer than 2 lie in the arena, round-robin over drop points — the sim has no randomness source (combat D6). The crates themselves live in `collectibles` since the pickups-to-collectibles lap (D1 there).
- Blast push radius and crater radius are separate tunables; distance is measured to the nearest point of the body box (combat D7, D8).
- Knockback and impulses still apply during spawn protection; only damage is blocked.
- Every shot has recoil (`combat.rocket.recoil`, applied by `fireRocket` through `kickShooter` in `rockets.ts`, kept apart from the rocket's touch / bounds logic): an instant velocity change opposite the aim, on the ground and in the air, so firing is also movement (down-shots hop or slow a fall, level shots push back, mostly felt in the air). An upward kick leaves the ground. It stacks with a rocket jump's blast, so match's `outOfBoundsMargin` counts it in the fastest launch (jumps-and-recoil D2). The blast impulse was scaled down with gravity (D1 in the player README) while `tumble.minImpulse` stayed, so only close blasts (within about a quarter of the radius) tumble victims (jumps-and-recoil D3).
- Every attack deals damage through `applyHit`; how much is the `combat.hitDamage` table by hit kind (`contact`, `blast`) and zone (`front`, `back`), never per-attack code. Defaults: contact 1 / 2, blast 1 / 1 (combat D10, owner scope change).
- Combat has no unarmed attack of its own: the dive lap provides it, plugged in through the `unarmedAttack` hook (combat D11, owner scope change).
