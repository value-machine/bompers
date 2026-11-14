# Brief — Game engine foundation

Task: Game engine foundation · Lap: temp_job_game-engine-foundation · Harness: v0.44.0

## Problem
Every gameplay task (movement, camera, arena, combat, match) needs one shared engine and a module map, or the parallel threads collide.

## Success check
Holding a player's "right" key (keyboard half 1) for N fixed steps moves that player's box right and gravity lands it on the level's solid cells; the same sim drives the Pixi canvas at `/`.

## In scope
- `pixi.js@8.23.0` (renderer only), StrictMode-safe Pixi mount hook (cancel flag + `app.destroy` in cleanup).
- Fixed-timestep loop (120 Hz accumulator, max sub-steps) driving a pure `stepGame(state, inputs, dt)`.
- Input for up to 4 slots: two keyboard halves + Gamepad API, sampled into plain `PlayerInput` objects.
- Terrain cell grid (empty / solid / destructible), collision queries, `clearCircle`, chunk dirty tracking + chunked redraw.
- Level data format (blocks, spawn points, drop points, out-of-bounds zone) + one placeholder level.
- One tunables module (gravity, match duration, …) and one placeholder palette module.
- Placeholder player box (run, gravity, jump, out-of-bounds respawn) proving input → sim → render; static fit-to-level camera.
- Module map in `ARCHITECTURE.md` + feature READMEs (homes and seams for player, camera, arena, combat, match).
- Game page at `/` replacing the template home.

## Out of scope
- Will NOT do: blob controller feel (Player movement task), multi-target camera (Camera task), the real start map (Arena task), rockets/health/scoring/respawn rules (combat/match tasks), lobby/join UI, sound.
- Will NOT touch: `/harness`, `/tasks`, Topbar, theme tokens (`src/shared/theme/tokens/`), `wrangler.jsonc`, CI workflows, `src/config/app-tasks.json`.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `src/shared/{services,utils,types,hooks,config}` (game engine) | Not found | flat engine modules | new — game-agnostic loop, input, Pixi mount, tunables, palette |
| `features/arena` | Not found | level + terrain grid + terrain renderer | new — bounded concept: the playfield |
| `features/player` | Not found | player state, controller system, player renderer | new — bounded concept: the avatar |
| `features/camera` | Not found | pure camera view + apply | new — bounded concept: framing |
| `features/match` | Not found | GameState composition, `stepGame`, systems order, GameView | new — bounded concept: one round |
| `pages/` + `App.tsx` | `/` → HomePage (harness card) | `/` → GamePage | ride — route swap; HomePage removed |
| `features/harness-overview` | card on home | README line only | ride — card stays, unmounted until lobby task |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — five new areas plus the route swap; no refactor of existing code.
Cut into laps: none (follow-ups already exist in the backlog).

## Decisions
DECISIONS.md D1–D6.
