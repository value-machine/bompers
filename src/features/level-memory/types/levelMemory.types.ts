/**
 * A remembered imported level: the file text (the source; parsed again on load, so a parser or
 * migration change applies to old copies) and, on browsers with the File System Access API, a
 * link to the file on disk.
 */
export interface LevelRecord {
  /** The level's `data-level-id`; one record per id (a re-import replaces it). */
  levelId: string;
  fileName: string;
  text: string;
  /** `File.lastModified` of the text saved here, to tell whether the linked file changed. */
  lastModified: number;
  savedAt: number;
  /** Chromium only: the file on disk, structured-cloned into IndexedDB. */
  handle?: FileSystemFileHandle;
}

/** Where remembered levels live. IndexedDB in the browser; in memory in tests or when blocked. */
export interface LevelStore {
  list: () => Promise<LevelRecord[]>;
  put: (record: LevelRecord) => Promise<void>;
  remove: (levelId: string) => Promise<void>;
}

/** What reading a linked file found. */
export type LinkedRead =
  /** The file is newer than the saved copy. */
  | { kind: "changed"; text: string; lastModified: number; fileName: string }
  | { kind: "unchanged" }
  /** The page may not read the file until the user clicks (after a reload). */
  | { kind: "needsPermission" }
  /** Moved, renamed or deleted. */
  | { kind: "missing" };

/** A file the user picked or dropped, with its handle when the browser gives one. */
export interface PickedFile {
  file: File;
  handle?: FileSystemFileHandle;
}
