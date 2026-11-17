/**
 * Level file import results. Codes are the rule numbers of the level file spec
 * (documentation/game/LEVEL_FORMAT.md § 7): E* rejects the file, W* loads it with a fallback.
 */
export type LevelErrorCode = "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8";
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
  | "W14";

export interface LevelIssue {
  /** Spec rule; absent for engine notes the spec has no number for. */
  code?: LevelErrorCode | LevelWarningCode;
  /** Readable sentence naming the element (role + id / label / ordinal). */
  message: string;
}

/** Every `data-role` value the current format knows. */
export type LevelRole = "terrain" | "spawn" | "drop" | "collectible" | "bounds";

/** A role element that passed the structural checks (W1–W3), with its readable name. */
export interface RoleElement {
  el: Element;
  role: LevelRole;
  /** e.g. `platform "main-core"`, `spawn #2`. */
  name: string;
}

/** Upgrades a format-N root element to format N+1, in place, before validation. */
export type LevelFileMigration = (root: Element) => void;
