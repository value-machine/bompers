/**
 * Level file import results. Codes are the rule numbers of the level file spec
 * (documentation/game/LEVEL_FORMAT.md § 7): E* rejects the file, W* loads it with a fallback.
 * E4, E7 and E8 are retired (now W18, W20, W21: forgiving-import); their numbers are not reused.
 */
export type LevelErrorCode = "E1" | "E2" | "E3" | "E5" | "E6";
export type LevelWarningCode =
  | "W1"
  | "W2"
  | "W3"
  | "W4"
  | "W5"
  | "W6"
  | "W7"
  | "W8"
  | "W9"
  | "W10"
  | "W11"
  | "W12"
  | "W13"
  | "W14"
  | "W15"
  | "W16"
  | "W17"
  | "W18"
  | "W19"
  | "W20"
  | "W21"
  | "W22"
  | "W23"
  | "W24";

export interface LevelIssue {
  /** Spec rule; absent for engine notes the spec has no number for. */
  code?: LevelErrorCode | LevelWarningCode;
  /** Readable sentence naming the element (role + id / label / ordinal). */
  message: string;
}

/** Outcome of the last import, shown to the player and copied for the author's AI. */
export interface LevelImportReport {
  fileName: string;
  ok: boolean;
  errors: LevelIssue[];
  warnings: LevelIssue[];
}

/** Every `data-role` value the current format knows. */
export type LevelRole = "terrain" | "object" | "spawn" | "drop" | "collectible" | "bounds";

/** A role element that passed the structural checks (W1–W3), with its readable name. */
export interface RoleElement {
  el: Element;
  role: LevelRole;
  /** e.g. `platform "main-core"`, `spawn #2`. */
  name: string;
}

/** Upgrades a format-N root element to format N+1, in place, before validation. */
export type LevelFileMigration = (root: Element) => void;

/**
 * How an imported level is remembered (level-file-handle): a saved copy in this browser, or
 * also linked to its file on disk (Chrome, Edge).
 */
export type LevelMemoryState =
  /** Saved copy only (every browser; drop the file again to update it). */
  | "copy"
  /** Reads from the file on disk; re-read when the window gets focus. */
  | "linked"
  /** Linked, and re-read from a changed file since the lobby opened. */
  | "updated"
  /** Linked, but after a reload the browser needs a click before it reads the file. */
  | "needsPermission"
  /** Linked file moved, renamed or deleted; the saved copy plays. */
  | "missing";
