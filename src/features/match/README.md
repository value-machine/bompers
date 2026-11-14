# match

## Purpose

One round of the game (timed round, scoring, respawn and spawn protection, winner and restart — GDD § 5, § 6), and the composition root of the game features: the `GameState` shape, the fixed-step simulation `stepGame` (systems order), the render composition, the session hook that runs loop + input + render, and the `GameView` component the `/` page mounts.

## Structure

| Layer      | Path                       | Purpose                                                                                                                                                                                                                                       |
| ---------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services   | `services/gameSim.ts`      | `GameState`, `createGameState({ level, tunables })`, `stepGame(state, inputs, dt)` — pure, no DOM; mutates and returns `state`                                                                                                                |
| Services   | `services/matchRules.ts`   | Step 5: out of bounds → elimination, scoring from combat's `playerEliminated` events (by `seq`) and collected orbs, respawn queue (a respawn also resets the player's dive, `resetDive`), spawn protection; `roundWinners`, `roundResultLabel`, `isRestartPress` |
| Services   | `services/spawnChoice.ts`  | `chooseSpawnIndex` — the spawn whose nearest active opponent is farthest (pure)                                                                                                                                                                    |
| Services   | `services/gameRenderer.ts` | Scene graph per DESIGN_LANGUAGE § 5: `world` (camera transform: terrain → pickups, point orbs → effects → rockets → dive impact pops → players (protected ones blink; dive pose overlays) → combat overlay) and `hud`; only players in play are drawn and framed; `renderGame` per frame frames the camera with `computeCameraView` (`settings: state.tunables.camera`) |
| Services   | `services/hudRenderer.ts`  | HUD (DESIGN_LANGUAGE § 7, simplified): timer card, one card per player (emblem chip, health chunks, score), round-result banner; fixed canvas colours only                                                                                         |
| Hooks      | `hooks/useGameSession.ts`  | `useGameSession(app, level)`: a new level object restarts the match. Per Pixi ticker frame: sample input → restart check → `advanceFixedStep` → N × `stepGame` → `renderGame`; a restart (jump after the round ended) rebuilds state and renderer on the same level; full teardown in cleanup |
| Components | `components/GameView.tsx`  | Canvas host (`usePixiApp`), the level from `level-file`'s `useLevelSource` + "Load level" control, drop a level file anywhere on the game (`useFileDrop`), controls hint (canvas ink on a cream pill, never theme tokens); "Load level" sits below the HUD card row |
| API        | `api/matchApi.ts`          | Simulation entry for other consumers (lobby, tests)                                                                                                                                                                                           |

Systems order in `stepGame` (new concepts slot into their number):

1. `joinSlots` — a connected input slot without a player gets one (the lobby lap replaces this with explicit joining)
2. `stepPlayers` — player feature; 2b. `resolveBodyContacts` — player feature (blob-vs-blob bounce among the players in play; its contacts feed 3b)
3. `stepCombat` — combat feature: rockets, blasts (damage, impulse, `clearCircle`), pickups; unarmed fire goes through its `unarmedAttack` hook to the dive's `requestDive`; 3b. `stepDives` — dive feature (the unarmed attack; hits go through combat's `applyHit`, a hard hit starts the player feature's tumble)
4. `stepCollectibles` — collectibles feature: point orbs; each orb collected scores `match.scoring.orb`
5. `stepMatchRules` — leaving `level.bounds` emits `playerEliminated` (cause `out-of-bounds`, credit to the last hitter within `combat.killCreditSeconds`); new eliminations score; eliminated players wait `respawnDelaySeconds` out of play, then respawn at the spawn farthest from the opponents in play (a level without spawns: the middle of its bounds) with `invulnerableUntil = now + spawnProtectionSeconds`
6. `roundTimer` — at 0 the round ends, `winners` is fixed and steps 1–5 stop

Steps 2–4 receive only the players in play (`playersInPlay`): a player waiting to respawn, or eliminated earlier in the same step, is not moved, hit or able to collect.

Adding a concept: add its slice to `GameState`, its system call at its number in `stepGame`, and its render layer (create + sync pair from its feature api) in `gameRenderer.ts`.

## Dependencies

- `level`, `level-file`, `arena`, `player`, `camera`, `combat`, `dive`, `collectibles` through their `api/` files.
- Shared engine: `gameLoop`, `gameInputService`, `usePixiApp`, `gameTunables`, `gamePalette`, `gameInput.types`.
- Mounted by `src/pages/GamePage.tsx` at `/`.

## Decisions

- Only `match` knows `GameState`; other features take slices (game-engine-foundation D5).
- Render the latest sim state without interpolation; revisit if motion stutters (game-engine-foundation D6).
- Fixed step 120 Hz, max 8 steps per frame; the backlog after a stall is dropped (`gameTunables.sim`).
- Scoring: kill +2, point orb +1, an elimination nobody gets credit for −1; no clamp, all in `match.scoring` (match-rules D1).
- Eliminated players are out of play for the respawn delay: not stepped, hit, drawn or framed (match-rules D3).
- Respawn at the spawn maximising the distance to the nearest opponent in play; ties → lowest index; level spawns are the author's safe points (match-rules D4).
- Spawn protection only blocks damage (combat), the player moves and fires freely; blink + dashed ring per DESIGN_LANGUAGE § 6 (match-rules D5).
- Round end: every top scorer wins (a draw lists them); restart by a jump press after `restartLockSeconds`; that press is consumed, so nobody jumps on the first frame of the new round (match-rules D6).
- HUD drawn on the canvas with fixed canvas colours, never theme tokens (match-rules D7).
