# arena

## Purpose

The terrain runtime: turns a level's terrain shapes into a cell grid, answers collision queries, clears cells in blasts, and draws the terrain layer. The level model itself lives in `level`; what materials exist lives in `content-catalog`.

## Structure

| Layer | Path | Purpose |
|-------|------|---------|
| Types | `types/arena.types.ts` | `TerrainGrid` (byte cells holding a slot index; `slots` = material ID + destructible + look token; slot 0 = empty), `TerrainCellSlot` |
| Services | `services/terrainRaster.ts` | `buildTerrainFromLevel(level)`: rasterises rect, polygon and circle shapes (a cell fills when its centre is inside, `shapeContains` from `src/shared/utils/shapeGeometry.ts`, non-zero rule; later pieces overwrite) |
| Services | `services/terrainGrid.ts` | Grid queries: `getCellInfo`, `isSolidAt`, `rectHitsSolid`, `clearCircle` (destructible cells only), `takeDirtyChunks` |
| Services | `services/terrainRenderer.ts` | Render layer: one Pixi `Graphics` per 16×16-cell chunk; redraws dirty chunks only; flat fill per material look (placeholder) |
| API | `api/arenaApi.ts` | Public seam + `ArenaState` and `createArenaState(level)` |

Seams for later work:
- **Blasts (combat):** `clearCircle(state.arena.terrain, { x, y, radius })` in sim step 3. Per-cell material is available via `getCellInfo` (destroy effect / sound from the catalog).
- **Visual pass:** stone lip, cell grid, pips and cracks (DESIGN_LANGUAGE § 2) go in `terrainRenderer.ts`, keyed by the slot's `lookToken`.
- **New maps:** not here: they are `LevelDefinition`s (see `level`).

## Dependencies

- `level` (`LevelDefinition`) and `content-catalog` (`resolveCatalogEntry` for material behaviour and look) through their `api/` files.
- `pixi.js` (renderer only), `src/shared/config/gamePalette.ts`, `src/shared/types/gameGeometry.types.ts`.
- Consumed by `player` (collision queries) and `match` (state + render composition).

## Decisions

- Terrain is a byte cell grid that blasts clear, not polygons or physics bodies (DOC_APP_VISION § Engine).
- A cell is destructible only when its piece's role is "destructible" **and** its material is destructible (game-engine-foundation D10).
- Out-of-range cells read as empty, so open map edges need no special case.
