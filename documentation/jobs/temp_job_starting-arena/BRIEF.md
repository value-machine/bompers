# Brief — Starting arena and destructible terrain

Task: Starting arena and destructible terrain · Lap: temp_job_starting-arena · Harness: v0.44.0 · Phase 1 of 2 (orchestrated run, game-orchestration)

## Problem

The game has only a hard-coded placeholder map; GDD § 4's start map does not exist as a real level file, so the level format (PR #4) is unproven on a real map.

## Success check

`public/levels/start-arena.html` follows `LEVEL_FORMAT.md` v1: with the kit served the preview panel lists 0 issues; offline it renders as a plain picture; a scripted spec check (centre-sampled rasterisation) finds no errors or warnings, every spawn stands on solid ground with indestructible stone below it, and every plateau is reachable with the engine's movement tunables (jump height ≈ 153 units).

## In scope

- `public/levels/start-arena.html`: floating main platform (stone core, dirt crust, dirt edge chunks and keel underneath), two thin dirt plateaus, one top plateau (stone heart, dirt wings), open side edges, no hazards; 4 spawns above stone; 5 sky drop points; 5 collectible points; one bounds rect with generous margins.
- Whitelist entry `public/levels/*.html` in `projectStructure.config.cjs` (orchestrator decision game-orchestration D4).
- Kit-served and offline screenshots (scratchpad, reported to the orchestrator).

## Out of scope

- Will NOT do (phase 2, after the importer lands): load the map as the game's default level, in-game play-test, geometry tuning from play.
- Will NOT touch: `src/**`, `src/config/app-tasks.json`, the level kit, the format spec.

## Edges

| Feature area                | Loop today                             | Hook point                                     | Ride / new                                      |
| --------------------------- | -------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| public/ (static assets)     | `level-kit/v1/` served as static files | new `public/levels/` (home of built-in levels) | new — whitelist entry (D4 of the orchestration) |
| projectStructure.config.cjs | whitelist                              | one `levels` child under `public`              | ride — same edit the importer thread makes      |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S — one data file + one whitelist line, no app code.
Cut into laps: phase 2 (importer default level + play-test tuning) waits for the orchestrator's OK on this branch.

## Decisions

DECISIONS.md D1…D4.

## Plan (S)

Acceptance check (scripted in the scratchpad, not shipped): Playwright opens the file (a) with kit URLs routed to the local `public/level-kit/v1/` → panel shows 0 issues, legend counts match; (b) with all network aborted → shapes visible, no errors. Node check: parse root, rasterise terrain on the 8-unit grid (centre sampling, platform beats destructible), check E1–E8 / W1–W10, spawn standing + stone below, plateau step heights ≤ jump height.

1. Write `public/levels/start-arena.html` (geometry below, multiples of 8).
2. Add `public/levels/*.html` to the whitelist; `pnpm validate:structure`.
3. Run both checks; save screenshots.

Geometry (world 1920 × 1440, cell 8, player 28 × 28, jump ≈ 153, run 320):

- Main surface y 960 (dirt crust x 480–1440, 32 thick); stone core x 576–1344 under it, tapering stone underside to y 1120; dirt keel to y 1184; dirt edge chunks x 480–576 / 1344–1440.
- Plateaus: tier 1 at y 848 (112 up), x 640–832 and 1088–1280, 16 thick dirt; top at y 736 (112 up), x 864–1056 dirt with stone heart 912–1008.
- Spawns (feet ~24 above surface, all above the stone core): (608, 936), (1312, 936), (736, 824), (1184, 824).
- Bounds 32,32 → 1888,1408: ≥ 448 units beside the main platform, 704 above the top plateau, 224 below the keel.
