/** Public seam of the level feature: the level model, its defaults and normalisation. */
export type {
  LevelCollectible,
  LevelDefinition,
  LevelDrop,
  LevelMeta,
  LevelSettings,
  NormalizedLevel,
  TerrainPiece,
  TerrainRole,
  TerrainShape,
} from "@/features/level/types/levelDefinition.types";
export {
  DEFAULT_LEVEL_SETTINGS,
  DEFAULT_MATERIAL_BY_ROLE,
  DEFAULT_POINT_ITEMS,
  LEVEL_FORMAT_VERSION,
  normalizeLevelDefinition,
} from "@/features/level/services/levelDefinition";
