# arena

## Purpose

The terrain runtime: turns a level's terrain shapes into a cell grid, answers collision queries, clears cells in blasts, and draws the terrain layer. The level model lives in `level`; which materials exist lives in `content-catalog`.

## Structure

| Layer    | Path                           | Purpose                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types    | `types/arena.types.ts`         | `TerrainGrid` (byte cells holding a slot index; `slots` = role + material ID + destructible + look token; slot 0 = empty), `TerrainCellSlot`                                                                                                                                                                                                           |
| Services | `services/terrainRaster.ts`    | `buildTerrainFromLevel(level)`: rasterises rect, polygon and circle shapes; a cell fills when its centre is inside (`shapeContains` from `src/shared/utils/shapeGeometry.ts`, non-zero rule for polygons); a platform cell is never overwritten by a destructible piece; between equal roles the later piece sets the material (LEVEL_FORMAT.md § 4)   |
| Services | `services/terrainGrid.ts`      | Grid queries: `getCellInfo`, `isSolidAt`, `rectHitsSolid`, `surfaceBelow` (contact shadows), `clearCircle` (destructible cells only; returns `{ removed, byMaterial }`), `takeDirtyChunks`                                                                                                                                                             |
| Services | `services/terrainRenderer.ts`  | Terrain layer (DESIGN_LANGUAGE § 2–3): indestructible pieces drawn once from the level shapes as rounded plum slabs with a top lip and a style-E silhouette (ink stroke pass under the fills, redrawn when the zoom-clamped width step changes); destructible tiles per 16×16-cell chunk, redrawn when dirty (plus neighbours) and cached as a texture |
| Services | `services/terrainTiles.ts`     | `readTile`: a visual tile of 2 × 2 cells (16 units) — intact, partly blasted, or cracked next to a crater (cell filled at load, empty now)                                                                                                                                                                                                             |
| Services | `services/backdropRenderer.ts` | Screen-space sky, sun, far hills + clouds (parallax 0.2), near hills (0.4), baked once into textures (tiling hill bands with opaque fills below; each layer stops where the one in front is opaque, so no overdraw); `createBackdropView(renderer)`, `syncBackdropView`                                                                                |
| API      | `api/arenaApi.ts`              | Public seam + `ArenaState` and `createArenaState(level)`                                                                                                                                                                                                                                                                                               |

Seams for later work:

- **Blasts:** `features/combat` calls `clearCircle` in sim step 3 and turns `byMaterial` into destroy effect / sound events from the catalog.
- **New maps:** not here; they are `LevelDefinition`s (see `level`).

## Dependencies

- `level` (`LevelDefinition`) and `content-catalog` (`resolveCatalogEntry` for material behaviour and look) through their `api/` files.
- `pixi.js` (renderer only), `src/shared/config/gamePalette.ts`, `src/shared/types/gameGeometry.types.ts`.
- Consumed by `player` (collision queries), `combat` (blasts, rocket collision), `collectibles` (weapon-crate landing, crate shadows) and `match` (state + render composition).

## Decisions

- Solid slabs are drawn from the level's piece shapes, not the grid: solid never changes, and a vector slab gives the spec's one continuous rounded shape; its edge may differ from collision by up to half a cell (visual-pass D2).
- Destructible tiles are 2 × 2 cells (16 units at cell 8), so 16-unit plateaus still show the grid (visual-pass D3). Colours come from the slot's `lookToken`.

- Terrain is a byte cell grid that blasts clear, not polygons or physics bodies (DOC_APP_VISION § Engine).
- A cell is destructible only when its piece's role is "destructible" **and** its material is destructible (game-engine-foundation D10).
- Out-of-range cells read as empty, so open map edges need no special case.
- `clearCircle` reports removed cells per material so the one owner of "which cells a circle clears" also feeds destroy effects (combat D9).
