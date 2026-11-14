# arena

## Purpose

The playfield: the level data format, the terrain cell grid (collision queries and blast destruction) and the terrain render layer. Owner of follow-up work: the starting-arena lap (real start map, GDD § 4).

## Structure

| Layer | Path | Purpose |
|-------|------|---------|
| Types | `types/arena.types.ts` | `LevelData` (blocks in cells; spawn points, drop points, out-of-bounds rect in world units), `TerrainGrid`, `TERRAIN_CELL` (empty / solid / destructible), `ArenaState` (the arena slice of `GameState`) |
| Services | `services/terrainGrid.ts` | Pure grid: `buildTerrainFromLevel`, `getCell`, `isSolidAt`, `rectHitsSolid`, `clearCircle` (removes destructible cells only, marks dirty chunks), `takeDirtyChunks` |
| Services | `services/placeholderLevel.ts` | Placeholder level proving the format; replace with the real start map |
| Services | `services/terrainRenderer.ts` | Render layer: one Pixi `Graphics` per 16×16-cell chunk; `syncTerrainView` redraws dirty chunks only |
| API | `api/arenaApi.ts` | Public seam (the only file other features import) + `createArenaState(level)` |

Seams for later work:
- **New map:** add a `LevelData` const in `services/` (e.g. `startLevel.ts`), export it from the api, and point `useGameSession` (match) at it. Blocks are applied in order, so carve-outs can follow fills.
- **Blasts (combat):** call `clearCircle(state.arena.terrain, { x, y, radius })` in sim step 3; the renderer picks up the dirty chunks on the next frame.
- **Drop points (combat / pickups):** read `state.arena.level.dropPoints`.

## Dependencies

- `pixi.js` (renderer only), `src/shared/config/gamePalette.ts` (colors), `src/shared/types/gameGeometry.types.ts`.
- Consumed by `player` (collision queries) and `match` (state + render composition) through `api/arenaApi.ts`. Arena imports no other game feature.

## Decisions

- Terrain is a byte cell grid that blasts clear, not polygons or physics bodies (DOC_APP_VISION § Engine).
- Out-of-range cells read as empty, so open map edges need no special case (game-engine-foundation).
- Renderer redraws per chunk, merging runs of equal cells per row (game-engine-foundation).
