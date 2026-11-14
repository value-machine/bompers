# player

## Purpose

The avatar: per-player simulation state, the controller system that moves players against the terrain, and the player render layer. Movement feel follows GDD § 2; the look follows `documentation/game/DESIGN_LANGUAGE.md` (Gumdrop Pop).

## Structure

| Layer    | Path                           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types    | `types/player.types.ts`        | `PlayerState` — position is the **feet point** (bottom-center), y down; velocity, `grounded`, `facing`, unit aim vector, jump / coyote / buffer / wall timers, `wallDir`, `groundBelowY`, and monotonic event counters (`jumpCount`, `wallJumpCount`, `landCount`, `lastLandingSpeed`) for the render layer                                                                                                                                                                                |
| Services | `services/playerController.ts` | `stepPlayers({ players, inputs, terrain, tunables, dt })` (sim step 2), `createPlayer`, `placePlayer`, `playerBody`. Per step: jump press / release (buffer, variable-height cut) → horizontal accel (ground accel / decel, turn boost, air steering; kept during the wall-jump lock) → aim → jump (ground, coyote, wall-jump) → gravity + wall-slide cap → axis-separated collision in half-cell sub-steps (no tunnelling, counts landings) → contact probes (wall, ground below, timers) |
| Services | `services/blobPose.ts`         | Pure render-only pose: squash / stretch from the event counters (land, jump, wall-jump), airborne stretch, idle breathing, foot lag + deform, contact-shadow geometry                                                                                                                                                                                                                                                                                                                      |
| Services | `services/playerRenderer.ts`   | Render layer: blob per player id (body + crescent + gloss, two feet, helmet with emblem ● ▲ ■ ✚, eyes toward aim, ink outline) over a shadow layer; shapes drawn once, `syncPlayersView(view, players, { nowMs?, squash?, protectedIds? })` sets transforms per frame; protected players blink (alpha 100 % / 45 % at 8 Hz) inside a dashed ink ring (DESIGN_LANGUAGE § 6)                                                                                                                                                                                                                                     |
| API      | `api/playerApi.ts`             | Public seam                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Tests: `services/playerController.test.ts` (feel on a stone test level: accel ramp, gravity-scaled jump apex, jump cut, coyote, buffer, wall-slide, wall-jump, aim fallback) and `services/blobPose.test.ts`.

Seams for later work:

- **Tuning:** every movement and squash number is in the `player` section of `src/shared/config/gameTunables.ts`. Jump apex = `jumpSpeed² / (2 · world.gravity)`, so a match's gravity setting scales jump height.
- **Visual pass:** zoom-scaled stroke widths, helmet spring wobble and wall-jump rotation are not built yet (`playerRenderer.ts`).
- **Combat** (`features/combat`) writes `vx` / `vy` for knockback and blast impulses (rocket jumps) and reads `aimX` / `aimY`; health, weapons and invulnerability live in combat state keyed by player `id`.

## Dependencies

- `arena` via `api/arenaApi.ts` (`rectHitsSolid`, `TerrainGrid`).
- Shared: `gameTunables`, `gamePalette`, `gameInput.types`, `gameInputMapping` (`EMPTY_PLAYER_INPUT`), `gameGeometry.types`; `pixi.js` for the renderer.
- Player colors: `GAME_PALETTE.players` / `playerShades` / `playerTints`, indexed by `slot` (DESIGN_LANGUAGE § 1).
- Consumed by `match` only.

## Decisions

- Fixed take-off speed: apex scales with gravity, so low-gravity maps jump higher (player-movement D1).
- Variable jump = one cut of the rise on release (player-movement D2); linear accel toward the input speed with a turn boost (D3).
- Sim → render events are monotonic counters on `PlayerState`, never per-step flags, because a frame may run several sim steps (player-movement D4). Squash never feeds back into the sim.
- The animation clock is a `syncPlayersView` option defaulting to `performance.now()` (D5); the sim scans `groundBelowY` for the contact shadow (D6).
- Systems receive the slices they need, never the whole `GameState`, so features stay acyclic (game-engine-foundation D5).
