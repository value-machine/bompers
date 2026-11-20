/**
 * Public seam of the arena feature (the terrain runtime): terrain grid queries / destruction,
 * building the grid from a level, and the terrain render layer.
 */
import type { LevelDefinition } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";

export type { MoverBody, TerrainCellSlot, TerrainGrid } from "@/features/arena/types/arena.types";
export { EMPTY_CELL } from "@/features/arena/types/arena.types";
export {
  bodyDistanceAt,
  bodyEdgeAbove,
  bodyGrids,
  bodyLocalPoint,
  bodyWorldPoint,
  clearCraterOnBodies,
  frozenVersionOf,
  poolCleared,
  terrainBodies,
  type ClearedBodies,
} from "@/features/arena/services/terrainBodies";
export {
  boxShapeVersion,
  burnOut,
  clearCrater,
  getCellInfo,
  isBreakableSlot,
  type ClearedCells,
  type ClearedLook,
  type Crater,
  gridDistanceAt,
  groundFrictionBelow,
  isSolidAt,
  moverAt,
  moverDistanceAt,
  moversDistanceAt,
  rectHitsSolid,
  surfaceBelow,
} from "@/features/arena/services/terrainGrid";
export { isFrozenSample, setSampleFrozen, thawAround } from "@/features/arena/services/terrainGrid";
export { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
export {
  circleHitsSolid,
  fieldDistanceAt,
  fieldNormalAt,
  settleCircle,
  type CircleSettle,
  type FieldCircle,
} from "@/features/arena/services/terrainField";
export {
  belowLipRegion,
  boxesMeet,
  drawContour,
  drawOutline,
  markedRegion,
  surfaceTiles,
  terrainContour,
  terrainRings,
  type MaskShapes,
  type OutlineRing,
  type SampleBox,
  type SampleRegion,
} from "@/features/arena/services/terrainSurfaces";
export {
  createPoseLayer,
  createTerrainView,
  placePoseLayer,
  syncTerrainView,
  type TerrainView,
} from "@/features/arena/services/terrainRenderer";

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
