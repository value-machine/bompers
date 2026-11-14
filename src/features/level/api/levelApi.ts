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
  LEVEL_FORMAT_VERSION,
  normalizeLevelDefinition,
} from "@/features/level/services/levelDefinition";
export { PLACEHOLDER_LEVEL } from "@/features/level/services/placeholderLevel";
