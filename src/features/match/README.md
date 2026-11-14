# match

## Purpose

One round of the game, and the composition root of the game features: the `GameState` shape, the fixed-step simulation `stepGame` (systems order), the render composition, the session hook that runs loop + input + render, and the `GameView` component the `/` page mounts.

## Structure

| Layer      | Path                       | Purpose                                                                                                                                                                            |
| ---------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services   | `services/gameSim.ts`      | `GameState`, `createGameState({ level, tunables })`, `stepGame(state, inputs, dt)` — pure, no DOM; mutates and returns `state`                                                     |
| Services   | `services/gameRenderer.ts` | Scene graph per DESIGN_LANGUAGE § 5: `world` (camera transform: terrain → shadows, pickups (reserved) → effects (dive impact rings) → players) and `hud` (round timer, prototype dive overlay); `renderGame` per frame |
| Hooks      | `hooks/useGameSession.ts`  | Per Pixi ticker frame: sample input → `advanceFixedStep` → N × `stepGame` → `renderGame`; full teardown in cleanup. Phase-1 prototype: Digit1–3 pick the dive option (`selectDiveOption`)                                                                |
| Components | `components/GameView.tsx`  | Canvas host (`usePixiApp`) + controls hint                                                                                                                                         |
| API        | `api/matchApi.ts`          | Simulation entry for other consumers (lobby, tests)                                                                                                                                |

Systems order in `stepGame` (new concepts slot into their number):

1. `joinSlots` — a connected input slot without a player gets one (the lobby lap replaces this with explicit joining)
2. `stepPlayers` — player feature; 2b. `resolveBodyContacts` — player feature (blob-vs-blob bounce; its contacts feed 3a)
3. 3a. `stepDives` — dive feature (unarmed attack; this step's `DiveHit`s are in `state.dive.hits`); 3b. _(reserved: combat — projectiles, blasts → `clearCircle`, health; its `applyHit` consumes the hits from 3a)_
4. `outOfBounds` — leaving `level.bounds` respawns (elimination credit + scoring later)
5. `roundTimer` — at 0 the round ends and steps 1–4 stop

Adding a concept: add its slice to `GameState`, its system call at its number in `stepGame`, and its render layer (create + sync pair from its feature api) in `gameRenderer.ts`.

## Dependencies

- `level`, `arena`, `player`, `dive`, `camera` through their `api/` files.
- Shared engine: `gameLoop`, `gameInputService`, `usePixiApp`, `gameTunables`, `gamePalette`, `gameInput.types`.
- Mounted by `src/pages/GamePage.tsx` at `/`.

## Decisions

- Only `match` knows `GameState`; other features take slices (game-engine-foundation D5).
- Render the latest sim state without interpolation; revisit if motion stutters (game-engine-foundation D6).
- Fixed step 120 Hz, max 8 steps per frame; the backlog after a stall is dropped (`gameTunables.sim`).
