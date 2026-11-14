# player

## Purpose

The avatar: per-player simulation state, the controller system that moves players against the terrain, and the player render layer. Owner of follow-up work: the player-movement lap (blob feel: accel curves, air steering, wall-jumps, squash and feet).

## Structure

| Layer    | Path                           | Purpose                                                                                                                                                                                                                                        |
| -------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/player.types.ts`        | `PlayerState` — position is the **feet point** (bottom-center), y down; velocity, `grounded`, `facing`, aim, `prevJump` (edge detection)                                                                                                       |
| Services | `services/playerController.ts` | `stepPlayers({ players, inputs, terrain, tunables, dt })` (sim step 2), `createPlayer`, `placePlayer`, `playerBody`. Placeholder feel: instant run, gravity, jump from ground; axis-separated collision in half-cell sub-steps (no tunnelling) |
| Services | `services/playerRenderer.ts`   | Render layer: one display object per player id; `syncPlayersView` creates, positions and removes them                                                                                                                                          |
| API      | `api/playerApi.ts`             | Public seam                                                                                                                                                                                                                                    |

Seams for later work:

- **Movement lap:** replace `applyInput` / `applyMotion` internals; keep `stepPlayers`' signature and the feet-point convention. Add new fields to `PlayerState` (e.g. `wallContact`, squash timers). Tunables go in the `player` section of `src/shared/config/gameTunables.ts`.
- **Blob visuals:** replace `drawPlayer` / per-frame updates in `playerRenderer.ts` (squash from `vy` / landing, feet, helmet aim from `aimX`/`aimY`).
- **Combat:** health, invulnerability and knockback belong to combat state keyed by player `id`, or as new `PlayerState` fields if the movement lap needs them (knockback = velocity).

## Dependencies

- `arena` via `api/arenaApi.ts` (`rectHitsSolid`, `TerrainGrid`).
- Shared: `gameTunables`, `gamePalette`, `gameInput.types`, `gameInputMapping` (`EMPTY_PLAYER_INPUT`), `gameGeometry.types`; `pixi.js` for the renderer.
- Player colors: `GAME_PALETTE.players` / `playerShades` / `playerTints`, indexed by `slot` (DESIGN_LANGUAGE § 1).
- Consumed by `match` only.

## Decisions

- Systems receive the slices they need, never the whole `GameState`, so features stay acyclic (game-engine-foundation D5).
