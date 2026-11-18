/**
 * Public seam of the level-file feature: importing level files (HTML + inline SVG) into the
 * engine's `LevelDefinition`, the level library (built-in manifest + session imports), the import control, and the level-kit
 * export the sync script writes.
 */
export type {
  LevelErrorCode,
  LevelIssue,
  LevelWarningCode,
} from "@/features/level-file/types/levelFile.types";
export { spawnLift } from "@/features/level-file/services/levelFileGeometry";
export {
  RECOMMENDED_SPAWNS,
  parseLevelFile,
  type LevelImportResult,
} from "@/features/level-file/services/levelFileParser";
export { LEVEL_FILE_MIGRATIONS } from "@/features/level-file/services/levelFileMigrations";
export {
  BUILT_IN_LEVEL_FILES,
  BUILT_IN_LEVEL_URLS,
} from "@/features/level-file/services/levelFileSource";
export {
  useLevelLibrary,
  type LevelImportReport,
  type LevelLibrary,
  type LevelLibraryEntry,
} from "@/features/level-file/hooks/useLevelLibrary";
export {
  LevelImportControl,
  type LevelFilePicker,
} from "@/features/level-file/components/LevelImportControl";
