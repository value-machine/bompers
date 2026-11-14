# level

## Purpose

The level model the engine runs on: `LevelDefinition` (geometry, spawns, drops, collectibles, bounds, per-level settings), its defaults, and normalisation against the content catalog. It maps 1:1 onto the level file contract (one self-contained HTML file with inline SVG). The HTML importer lives in `level-file`; the engine never reads a file format.

## Structure

| Layer | Path | Purpose |
|-------|------|---------|
| Types | `types/levelDefinition.types.ts` | `LevelDefinition` `{ formatVersion, meta{levelId, title, author?, agent?, description?}, settings{cellSize, gravity, matchDurationS?}, worldSize{w,h}, terrain[{shape: rect\|polygon\|circle, role: platform\|destructible, materialId, effectId?, soundId?, behaviorId?}], spawns[], drops[{at, itemIds}], collectibles[{at, itemId}], bounds{x,y,w,h} }` |
| Services | `services/levelDefinition.ts` | `LEVEL_FORMAT_VERSION`, `DEFAULT_LEVEL_SETTINGS` (cellSize 8, gravity 1), `DEFAULT_MATERIAL_BY_ROLE` (platform → stone, destructible → dirt), `DEFAULT_POINT_ITEMS` (drop → rocket-launcher, collectible → point-orb), `normalizeLevelDefinition(level)` → `{ level, warnings }` |
| API | `api/levelApi.ts` | Public seam |

Units: world units = SVG units, origin top-left, y down. Spawn points are feet points (bottom-centre of a player). `bounds` is the in-bounds area; leaving it eliminates. `settings.gravity` multiplies the engine default.

Normalisation never throws: an unknown material becomes the role default, unknown effect / sound / behavior references are replaced by the catalog fallback or dropped, unknown item IDs are dropped (an empty drop is removed), fewer than 2 spawns is reported. Each correction adds a warning string naming the path (`terrain[3]: unknown material "lava", using "stone"`).

Seams for later work:
- **Starting-arena lap:** adds `public/levels/start-arena.html` and points `BUILT_IN_LEVEL_URL` (`level-file`) at it.

## Dependencies

- `content-catalog` through `api/contentCatalogApi.ts` (ID lookup). `src/shared/types/gameGeometry.types.ts`.
- Consumed by `level-file` (importer), `arena` (rasterising), `match` (`createGameState` normalises and applies settings).
- `TerrainShape` is `Shape2D` from `src/shared/types/gameGeometry.types.ts`.

## Decisions

- Levels hold geometry and gameplay data only; looks, sounds and behaviours are string IDs resolved through the content catalog (orchestrator, owner requirement).
- Unknown IDs resolve to a safe default plus a warning, never a crash (orchestrator).
