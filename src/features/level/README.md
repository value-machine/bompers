# level

## Purpose

The level model the engine runs on: `LevelDefinition` (geometry, spawns, drops, collectibles, bounds, per-level settings) and its normalisation against the content catalog. It maps 1:1 onto the level file format (one self-contained HTML file with inline SVG, `documentation/game/LEVEL_FORMAT.md`). The HTML importer lives in `level-file`; the engine never reads a file format.

## Structure

| Layer    | Path                             | Purpose                                                                                                                                                                                                                                                                                                                                                    |
| -------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/levelDefinition.types.ts` | `LevelDefinition` `{ formatVersion, meta{levelId, title, author?, agent?, description?}, settings{cellSize, gravity, matchDurationS?}, worldSize{w,h}, terrain[{shape: rect\|polygon\|circle, role: platform\|destructible, materialId, effectId?, soundId?, behaviorId?}], spawns[], drops[{at, itemIds}], collectibles[{at, itemId}], bounds{x,y,w,h} }` |
| Services | `services/levelDefinition.ts`    | `LEVEL_FORMAT_VERSION`, `DEFAULT_LEVEL_SETTINGS` (from the catalog defaults), `normalizeLevelDefinition(level)` → `{ level, warnings }`                                                                                                                                                                                                                    |
| API      | `api/levelApi.ts`                | Public seam                                                                                                                                                                                                                                                                                                                                                |

Units: 1 world unit = 1 SVG unit, origin top-left, y down. Spawn points are feet points (bottom-centre of a player). `bounds` is the in-bounds area; leaving it eliminates. `settings.gravity` multiplies the engine default.

Normalisation applies the format's warnings that make sense on a parsed level and never throws. Each correction adds a warning naming its path (`terrain[3]: unknown material "lava", using "stone"`):

- W4: unknown material → role default from the catalog; unknown effect / sound / behavior → dropped, so the material's default applies; unknown items → removed, a drop left empty gets the default drop items, a collectible gets the default collectible.
- W5: spawn, drop and collectible points outside `bounds` are ignored. Spawn-inside-terrain needs the grid and is the importer's check.
- W8: out-of-range settings → defaults.
- Fewer than 2 valid spawns → warning (the importer turns it into error E5).

The structural errors E1–E8 belong to the importer.

Seams for later work:

- **Starting-arena lap:** adds `public/levels/start-arena.html` and points `BUILT_IN_LEVEL_URL` (`level-file`) at it.

## Dependencies

- `content-catalog` through `api/contentCatalogApi.ts` (IDs, defaults). `src/shared/types/gameGeometry.types.ts` (`TerrainShape` is `Shape2D`).
- Consumed by `level-file` (importer), `arena` (rasterising) and `match` (`createGameState` normalises and applies settings).

## Decisions

- Levels hold geometry and gameplay data only; looks, sounds and behaviours are string IDs resolved through the content catalog (owner requirement, via orchestrator).
- Unknown IDs resolve to a safe default plus a warning, never a crash (orchestrator).
