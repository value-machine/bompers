# Brief — Level importer in the game

Task: Level importer in the game · Lap: temp_job_level-importer · Harness: v0.44.0 · Thread of the game-orchestration run (base: `claude/game-engine-foundation` + merged `claude/level-file-format`).

## Problem
Level files (one HTML file with inline SVG, `documentation/game/LEVEL_FORMAT.md`) can be written and previewed, but the game can't play them, and the kit's catalog.json is hand-written, so it drifts as content grows.

## Success check
Picking or dropping the kit's `example-level.html` on the game page restarts the match on that level; a broken file is rejected with the spec's error codes naming the element; `pnpm level-kit:check` fails when the content catalog changes without regenerating the kit.

## In scope
- `src/features/level-file/`: parser (E1–E8, W1–W10), migration registry, built-in level source, "Load level" control, kit export.
- `public/levels/floating-garden.html` (copy of the kit example) as the built-in level, loaded by fetch.
- `scripts/sync-level-kit.mjs` + `pnpm level-kit:sync` / `level-kit:check`; CI step; pre-commit when inputs are staged.
- Generated catalog.json and catalog-ID tables (AUTHORING.md, LEVEL_FORMAT.md).
- preview.css on the Gumdrop Pop palette.

## Out of scope
- Will NOT do: start-arena level (arena thread), terrain destruction, catalog content changes, level picker / multiple built-ins.
- Will NOT touch: preview.js behaviour, engine physics.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| level-file | Not found | new feature | new — file format ≠ level model (bounded context) |
| level | model + normalise; placeholder TS level | placeholder removed (dead after the built-in file); defaults come from `CATALOG_DEFAULTS` | ride |
| match | `useGameSession(app)` plays the placeholder | `useGameSession(app, level)`; `GameView` mounts the control + drop | ride |
| arena | private `shapeContains` (non-zero since 3991968) | uses `src/shared/utils/shapeGeometry.ts` (non-zero, spec § 4) | ride |
| shared | — | `Shape2D`, `shapeContains`, `useFileDrop` | new |
| kit / CI / structure | hand-written catalog.json | generated + `level-kit:check` | ride (ci.yml, .husky, projectStructure approved by the orchestrator, game-orchestration D4) |

## Size
M — one new feature (15 files), four touched features, kit + CI wiring.
Cut into laps: none.

## Decisions
- D1 New feature `level-file` rather than growing `level` (layer budget, separate concept).
- D2 (superseded) Terrain sorted destructible-first: dropped after the engine's 3991968, whose raster itself keeps platform cells over destructibles.
- D3 Point-in-shape moved to `src/shared/utils/shapeGeometry.ts` (2 consumers: importer, raster), non-zero rule (spec).
- D4 catalog.json = `exportCatalog()` (kit shape since 3991968) plus a generated-file `$comment`; preview.js unchanged.
- D5 Kit script loads the TS export through Vite (`ssrLoadModule`, ~2 s), no new dependency.
- D6 preview.css forces the kit sky over a file's inline background, like the role fills.

## Check summary
- `pnpm type-check`, `lint` (no new warnings), `format:check`, `validate:structure`, `validate:feature-docs:strict`, `validate:feature-size`, `arch:check:ci`, `level-kit:check`, `validate:docs`, `test:classify` (152), `test:run` (149), `build`: pass.
- Headless Chromium on `pnpm preview`: built-in level renders; example file via the file input → "Loaded", timer restarts; broken file → E8/E6/E4/E5/E7 listed, previous level keeps playing; drag-and-drop shows the overlay and loads AUTHORING's Tiny Box; kit example page: 0 preview issues, Gumdrop Pop colours.
- Not verified: Cloudflare preview and GitHub Actions (blocked on owner settings); real mouse drag from the OS file manager (simulated DataTransfer only).
