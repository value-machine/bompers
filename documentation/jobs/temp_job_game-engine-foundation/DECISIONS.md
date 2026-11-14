# Decisions — game-engine-foundation

Job: `temp_job_game-engine-foundation`
Updated: 2026-11-14

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Engine + dependency | closed | pixi.js@8.23.0 renderer, own pure-TS sim, no physics engine, no @pixi/react | loop-refine | orchestrator call (DOC_APP_VISION § Engine) |
| D2 | Where engine code lives | closed | flat game-agnostic modules in `src/shared/{services,utils,types,hooks,config}` (prefix `game`) | loop-refine | clear-winner: whitelist allows only flat files in shared/; alternative `features/game-engine` rejected (not a domain concept) |
| D3 | Feature split | closed | `arena`, `player`, `camera`, `match` now; `combat` later | loop-refine | clear-winner per architecture § Feature granularity; nested `features/game/*` rejected (extra level, no gain) |
| D4 | Cross-feature seam | closed | each feature exposes `api/<feature>Api.ts`; `match` is the only composer | loop-refine | clear-winner: features have no root `index.ts` in the whitelist; `api/` is the allowed public seam |
| D5 | Systems take slices, not GameState | closed | `stepPlayers(players, inputs, terrain, tunables, dt)` etc.; only `match` knows `GameState` | loop-refine | clear-winner: keeps features acyclic (player → arena, never back) |
| D6 | Render interpolation | closed | render the latest sim state, no interpolation | loop-refine | clear-winner for now: 120 Hz sim ≥ display rate; revisit if motion stutters |
| D7 | Camera timing | closed | per rendered frame, outside the fixed-step sim | loop-build | clear-winner: presentation that depends on viewport size |
| D8 | Tunables type location | closed | interface in `shared/types/gameTunables.types.ts`, values in `shared/config/gameTunables.ts` | loop-build | dependency-cruiser `no-non-types-in-types`; `GameState` moved into `match/services/gameSim.ts` for the same reason |
| D9 | Level model + catalog | closed | `features/level` (LevelDefinition 1:1 with the HTML/SVG file contract, normalisation) + `features/content-catalog` (IDs per kind, resolve with fallback, JSON export); arena = terrain runtime | loop-build | orchestrator review 14:25 (owner requirement: AI-authored level files) |
| D10 | Destructible cells | closed | destructible iff role "destructible" AND material.destructible | loop-build | orchestrator: role + material, no hard-coded kind |
| D11 | Palette source | closed | DESIGN_LANGUAGE.md § 1 values in `gamePalette.ts`; draw order § 5 | loop-build | orchestrator; PR #3 not merged into this branch |
| D12 | Shared Rect fields | closed | `{ x, y, w, h }` everywhere | loop-build | clear-winner: one Rect, same names as the level file |
| D13 | Level vocabulary | closed | follow LEVEL_FORMAT.md v1 (PR #4): catalog fields `label`, material `effect`/`sound`, item `use`, `defaults`; non-zero polygons; platform wins overlaps; W4/W5/W8 in normalisation, E1–E8 in the importer | loop-build | orchestrator 14:41 |
| D14 | Palette keys | closed | `players`, `playerShades`, `playerTints`, `ink`, `helmet` (the movement thread codes against them) | loop-build | orchestrator 14:43 |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-14 — D1–D6 closed via loop-refine (clear-winner / orchestrator)
- 2026-11-14 — D7–D8 closed via loop-build (clear-winner)
- 2026-11-14 — D9–D12 closed via loop-build (orchestrator / clear-winner)
- 2026-11-14 — D13–D14 closed via loop-build (orchestrator)
