# arena

## Purpose

The terrain runtime: turns a level's terrain shapes into a cell grid, answers collision queries, clears cells in blasts, and draws the terrain layer. The level model lives in `level`; which materials exist lives in `content-catalog`.

## Structure

| Layer    | Path                           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types    | `types/arena.types.ts`         | `TerrainGrid` (byte cells holding a slot index; `slots` = material ID + colour ID + toughness (`null` = unbreakable) + friction + surface; one slot per material + colour; slot 0 = empty), `TerrainCellSlot`                                                                                                                                                                                                                                                                                                       |
| Services | `services/terrainRaster.ts`    | `buildTerrainFromLevel(level)`: rasterises rect, polygon and circle shapes; a cell fills when its centre is inside (`shapeContains` from `src/shared/utils/shapeGeometry.ts`, non-zero rule for polygons); an unbreakable cell is never overwritten by a breakable piece; otherwise the later piece sets material and colour (LEVEL_FORMAT.md § 4)                                                                                                                                              |
| Services | `services/terrainGrid.ts`      | Grid queries: `getCellInfo`, `isSolidAt`, `rectHitsSolid`, `surfaceBelow` (contact shadows), `clearCrater` (a breakable cell clears where its distance from the crater centre × its toughness ≤ `reach`, so soft materials open wider; returns `{ removed, byLook: [{ materialId, colorId, cells }] }`), `isBreakableSlot`, `groundFrictionBelow` (average friction of the cells under a span; ice grip for the player), `takeDirtyChunks`                                                                                                                                                                              |
| Services | `services/terrainRenderer.ts`  | Terrain layer (DESIGN_LANGUAGE § 2–3): every piece is the same rounded slab with a top lip in its colour swatch and a style-E silhouette (ink pass under the fills, redrawn on a zoom-clamped width step). Breakable slabs' fills are clipped by a stencil mask of their standing cells, their ink by the same mask grown by the outline width (masks rebuilt when chunks are dirty). Seams, pips and cracks per 16×16-cell chunk, redrawn when dirty (plus neighbours) and cached as a texture |
| Services | `services/terrainSurfaces.ts`  | Slab drawing shared by every material: `slabPath`, `drawSlabInk`, `drawSlabFill` (fill, lip, ice gloss streaks + white inner rim), `drawBreakableMasks` (one rect per row run of breakable cells; exact for fills, grown for ink)                                                                                                                                                                                                                                                               |
| Services | `services/terrainTiles.ts`     | `readTile`: a visual tile of 2 × 2 cells (16 units) — intact, partly blasted, or cracked next to a crater (cell filled at load, empty now); the seam grid is drawn between intact tiles                                                                                                                                                                                                                                                                                                         |
| Services | `services/backdropRenderer.ts` | Screen-space sky, sun, far hills + clouds (parallax 0.2), near hills (0.4), baked once into textures (tiling hill bands with opaque fills below; each layer stops where the one in front is opaque, so no overdraw); `createBackdropView(renderer)`, `syncBackdropView`                                                                                                                                                                                                                         |
| API      | `api/arenaApi.ts`              | Public seam + `ArenaState` and `createArenaState(level)`                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Seams for later work:

- **Blasts:** `features/combat` calls `clearCrater` (reach from the blast's power) in sim step 3 and turns `byLook` into destroy effect / sound events (catalog material) with the colour for debris.
- **New maps:** not here; they are `LevelDefinition`s (see `level`).

## Dependencies

- `level` (`LevelDefinition`) and `content-catalog` (`resolveCatalogEntry` for material behaviour) through their `api/` files.
- `pixi.js` (renderer only), `src/shared/config/gamePalette.ts`, `src/shared/types/gameGeometry.types.ts`.
- Consumed by `player` (collision queries), `combat` (blasts, rocket collision), `collectibles` (weapon-crate landing, crate shadows) and `match` (state + render composition).

## Decisions

- Solid slabs are drawn from the level's piece shapes, not the grid: solid never changes, and a vector slab gives the spec's one continuous rounded shape; its edge may differ from collision by up to half a cell (visual-pass D2).
- Seam tiles are 2 × 2 cells (16 units at cell 8), so 16-unit plateaus still show the grid (visual-pass D3). Colours come from the slot's `colorId` (palette `terrainSwatches`).

- Terrain is a byte cell grid that blasts clear, not polygons or physics bodies (DOC_APP_VISION § Engine).
- A cell is breakable when its material is (no terrain roles; material-system D5). Every material draws as the same slab; breakable slabs are clipped to standing cells by stencil masks, and behaviour shows as a surface pattern (seams, ice gloss), never as colour (owner, material-system D1, D3, D8).
- Out-of-range cells read as empty, so open map edges need no special case.
- `clearCrater` reports removed cells per material + colour so the one owner of "which cells a crater clears" also feeds destroy effects (combat D9).
- Breakability is the material's toughness, not a flag (blast-power D1, D2): cardboard 0.7, earth 1, stone and ice `null` (unbreakable). The crater test is a distance rule per cell so the distance-field lap can reuse it with other crater shapes (blast-power D17–D19).
