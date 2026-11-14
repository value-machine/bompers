# player

## Purpose

The avatar: per-player simulation state, the controller system that moves players against the terrain, and the player render layer. Movement feel follows GDD § 2; the look follows `documentation/game/DESIGN_LANGUAGE.md` (Gumdrop Pop).

## Structure

| Layer    | Path                           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types    | `types/player.types.ts`        | `PlayerState` — position is the **feet point** (bottom-center), y down; velocity, `grounded`, `facing`, unit aim vector, jump / coyote / buffer / wall timers, `wallDir`, `groundBelowY`, and monotonic event counters (`jumpCount`, `wallJumpCount`, `landCount`, `lastLandingSpeed`) for the render layer                                                                                                                                                                                |
| Services | `services/playerController.ts` | `stepPlayers({ players, inputs, terrain, tunables, dt })` (sim step 2), `createPlayer`, `placePlayer`, `playerBody`. Per step: jump press / release (buffer, variable-height cut) → horizontal accel (ground accel / decel, turn boost, air steering; kept during the wall-jump lock) → aim → jump (ground, coyote, wall-jump) → gravity + wall-slide cap → axis-separated collision in half-cell sub-steps (no tunnelling, counts landings) → contact probes (wall, ground below, timers) |
| Services | `services/blobPose.ts`         | Pure render-only pose: squash / stretch from the event counters (land, jump, wall-jump), airborne stretch, idle breathing, foot lag + deform, contact-shadow geometry                                                                                                                                                                                                                                                                                                                      |
| Services | `services/playerRenderer.ts`   | Render layer: blob per player id (body + crescent + gloss, two feet, helmet with emblem ● ▲ ■ ✚, eyes toward aim, ink outline) over a shadow layer; shapes drawn once, `syncPlayersView(view, players, { nowMs?, squash? })` sets transforms per frame                                                                                                                                                                                                                                     |
| Services | `services/bodyCollision.ts`    | `resolveBodyContacts({ players, terrain, tunables })` (sim step 2b): blob-vs-blob contact. Equal-mass circles; along the contact normal each blob's velocity changes by `min((1 + e) / 2 · closingSpeed, maxImpulse)`; no bounce below `restingSpeed`; a grounded blob pushed downward counts as immovable; positions separate with the controller's terrain-safe `moveAxis`. Returns the `BodyContact[]` (pair, normal, approach speeds, impulse) for later systems |
| API      | `api/playerApi.ts`             | Public seam                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Seams for later work:

- **Tuning:** every movement and squash number is in the `player` section of `src/shared/config/gameTunables.ts`. Jump apex = `jumpSpeed² / (2 · world.gravity)`, so a match's gravity setting scales jump height.
- **Visual pass:** zoom-scaled stroke widths, helmet spring wobble and wall-jump rotation are not built yet (`playerRenderer.ts`).
- **Abilities (dive, later stuns / recoil):** write `steerScale`, `gravityScale` and `jumpLocked` on `PlayerState`; the controller applies them on the next step. Read `terrainHitX` / `terrainHitY` (+ speeds) to react to walls and floors. For a pose, pass `overlays` (`BlobPoseOverlay` by player id) to `syncPlayersView`.
- **Combat:** knockback and rocket jumps = writing `vx` / `vy`; the rocket tube points along `aimX` / `aimY`. Health and invulnerability belong to combat state keyed by player `id`.

## Dependencies

- `arena` via `api/arenaApi.ts` (`rectHitsSolid`, `TerrainGrid`).
- Shared: `gameTunables`, `gamePalette`, `gameInput.types`, `gameInputMapping` (`EMPTY_PLAYER_INPUT`), `gameGeometry.types`; `pixi.js` for the renderer.
- Player colors: `GAME_PALETTE.players` / `playerShades` / `playerTints`, indexed by `slot` (DESIGN_LANGUAGE § 1).
- Consumed by `match` and `dive`.

## Decisions

- Fixed take-off speed: apex scales with gravity, so low-gravity maps jump higher (player-movement D1).
- Variable jump = one cut of the rise on release (player-movement D2); linear accel toward the input speed with a turn boost (D3).
- Sim → render events are monotonic counters on `PlayerState`, never per-step flags, because a frame may run several sim steps (player-movement D4). Squash never feeds back into the sim.
- The animation clock is a `syncPlayersView` option defaulting to `performance.now()` (D5); the sim scans `groundBelowY` for the contact shadow (D6).
- Blob-vs-blob collision lives here (dive-headbutt D1): it is about `PlayerState` bodies and uses the controller's terrain-safe move. Bodies are circles for blob contact, boxes for terrain (D4). A blob that cannot give way is immovable for that contact, so others bounce off it (D5).
- Ability systems steer the controller only through the generic motion modifiers; the controller has no ability-specific branch (dive-headbutt D2).
- Systems receive the slices they need, never the whole `GameState`, so features stay acyclic (game-engine-foundation D5).
