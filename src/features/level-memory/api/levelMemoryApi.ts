/**
 * Public seam of the level-memory feature: remembering imported levels in this browser (a saved
 * copy in IndexedDB) and, on Chrome / Edge, linking them to their file on disk.
 */
export type {
  LevelRecord,
  LevelStore,
  LinkedRead,
  PickedFile,
} from "@/features/level-memory/types/levelMemory.types";
export {
  createBrowserLevelStore,
  createIndexedDbLevelStore,
  createMemoryLevelStore,
} from "@/features/level-memory/services/levelStore";
export {
  canLinkFiles,
  droppedFileHandle,
  pickLinkedFile,
  readIfChanged,
  relinkFile,
} from "@/features/level-memory/services/levelFileLink";
