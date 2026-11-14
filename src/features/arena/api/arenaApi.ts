/**
 * Public seam of the arena feature (the only file other features import). Level format,
 * terrain grid queries / destruction, and the terrain render layer.
 */
export type {
  ArenaState,
  LevelBlock,
  LevelData,
  TerrainCellKind,
  TerrainGrid,
} from "@/features/arena/types/arena.types";
export { TERRAIN_CELL } from "@/features/arena/types/arena.types";
export {
  buildTerrainFromLevel,
  clearCircle,
  getCell,
  isSolidAt,
  rectHitsSolid,
} from "@/features/arena/services/terrainGrid";
export { PLACEHOLDER_LEVEL } from "@/features/arena/services/placeholderLevel";
export {
  createTerrainView,
  syncTerrainView,
  type TerrainView,
} from "@/features/arena/services/terrainRenderer";

import type { ArenaState, LevelData } from "@/features/arena/types/arena.types";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainGrid";

/** Fresh arena state for a level (the terrain is rebuilt; the level data is shared, read-only). */
export const createArenaState = (level: LevelData): ArenaState => ({
  level,
  terrain: buildTerrainFromLevel(level),
});
