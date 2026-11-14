/**
 * Public seam of the level-file feature: importing level files (HTML + inline SVG) into the
 * engine's `LevelDefinition`, the built-in level source, the import control, and the level-kit
 * export the sync script writes.
 */
export type {
  LevelErrorCode,
  LevelIssue,
  LevelWarningCode,
} from "@/features/level-file/types/levelFile.types";
export {
  parseLevelFile,
  type LevelImportResult,
} from "@/features/level-file/services/levelFileParser";
export { LEVEL_FILE_MIGRATIONS } from "@/features/level-file/services/levelFileMigrations";
export { BUILT_IN_LEVEL_URL } from "@/features/level-file/services/levelFileSource";
export {
  useLevelSource,
  type LevelImportReport,
  type LevelSource,
} from "@/features/level-file/hooks/useLevelSource";
export { LevelImportControl } from "@/features/level-file/components/LevelImportControl";
