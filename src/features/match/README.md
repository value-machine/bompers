# match

## Purpose

One round of the game, and the composition root of the game features: the `GameState` shape, the fixed-step simulation `stepGame` (systems order), the render composition, the session hook that runs loop + input + render, and the `GameView` component the `/` page mounts.

## Structure

| Layer      | Path                       | Purpose                                                                                                                                                                                                                                                          |
| ---------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services   | `services/gameSim.ts`      | `GameState`, `createGameState({ level, tunables })`, `stepGame(state, inputs, dt)` — pure, no DOM; mutates and returns `state`                                                                                                                                   |
| Services   | `services/gameRenderer.ts` | Scene graph per DESIGN_LANGUAGE § 5: `world` (camera transform: terrain → pickups → effects → rockets → players → combat overlay) and `hud` (round timer); `renderGame` per frame frames the camera with `computeCameraView` (`settings: state.tunables.camera`) |
| Hooks      | `hooks/useGameSession.ts`  | `useGameSession(app, level)`: a new level object restarts the match. Per Pixi ticker frame: sample input → `advanceFixedStep` → N × `stepGame` → `renderGame`; full teardown in cleanup                                                                          |
| Components | `components/GameView.tsx`  | Canvas host (`usePixiApp`), the level from `level-file`'s `useLevelSource` + "Load level" control, drop a level file anywhere on the game (`useFileDrop`), controls hint                                                                                         |
| API        | `api/matchApi.ts`          | Simulation entry for other consumers (lobby, tests)                                                                                                                                                                                                              |

Systems order in `stepGame` (new concepts slot into their number):

1. `joinSlots` — a connected input slot without a player gets one (the lobby lap replaces this with explicit joining)
2. `stepPlayers` — player feature
3. `stepCombat` — combat feature: rockets (unarmed fire: hook for the dive lap), blasts (damage, impulse, `clearCircle`), pickups
4. `respawnPlayers` — leaving `level.bounds` emits `playerEliminated` (cause `out-of-bounds`, credit to a recent hitter); out-of-bounds or combat-eliminated players go back to their slot's spawn with full health (spawn choice, protection and scoring: match-rules lap)
5. `roundTimer` — at 0 the round ends and steps 1–4 stop

Adding a concept: add its slice to `GameState`, its system call at its number in `stepGame`, and its render layer (create + sync pair from its feature api) in `gameRenderer.ts`.

## Dependencies

- `level`, `level-file`, `arena`, `player`, `camera`, `combat` through their `api/` files.
- Shared engine: `gameLoop`, `gameInputService`, `usePixiApp`, `gameTunables`, `gamePalette`, `gameInput.types`.
- Mounted by `src/pages/GamePage.tsx` at `/`.

## Decisions

- Only `match` knows `GameState`; other features take slices (game-engine-foundation D5).
- Render the latest sim state without interpolation; revisit if motion stutters (game-engine-foundation D6).
- Fixed step 120 Hz, max 8 steps per frame; the backlog after a stall is dropped (`gameTunables.sim`).
