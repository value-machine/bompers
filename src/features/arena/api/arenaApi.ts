/**
 * Public seam of the arena feature (the terrain runtime): terrain grid queries / destruction,
 * building the grid from a level, and the terrain render layer.
 */
import type { LevelDefinition } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";

export type { TerrainCellSlot, TerrainGrid } from "@/features/arena/types/arena.types";
export { EMPTY_CELL } from "@/features/arena/types/arena.types";
export {
  clearCircle,
  getCellInfo,
  type ClearedCells,
  isSolidAt,
  rectHitsSolid,
  surfaceBelow,
} from "@/features/arena/services/terrainGrid";
export { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
export {
  createTerrainView,
  syncTerrainView,
  type TerrainView,
} from "@/features/arena/services/terrainRenderer";
export {
  createBackdropView,
  syncBackdropView,
  type BackdropFrame,
  type BackdropView,
} from "@/features/arena/services/backdropRenderer";

/** The arena slice of the game state (declared here: types/ may not import another feature). */
export interface ArenaState {
  /** Normalised level (all IDs exist in the content catalog). */
  level: LevelDefinition;
  terrain: TerrainGrid;
}

/** Fresh arena state for a normalised level (the terrain is rebuilt; the level is read-only). */
export const createArenaState = (level: LevelDefinition): ArenaState => ({
  level,
  terrain: buildTerrainFromLevel(level),
});
