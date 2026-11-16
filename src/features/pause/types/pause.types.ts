/** A pause-menu row (order: `PAUSE_ROWS`). Player preferences only; "mainMenu" = the lobby. */
export type PauseRow = "resume" | "music" | "sfx" | "musicVolume" | "sfxVolume" | "mainMenu";

export interface PauseMenuState {
  open: boolean;
  /** Index into `PAUSE_ROWS` of the shared cursor (any player in the match moves it). */
  cursor: number;
}

/** A menu button of any player in the match; `pause` is pad Start / Escape. */
export type PauseButton = "up" | "down" | "left" | "right" | "confirm" | "back" | "pause";

/** What the match session needs: is the match paused, and hand the menu a player's press. */
export interface PauseLink {
  isOpen: () => boolean;
  press: (button: PauseButton) => void;
}

export type PauseAction =
  | { type: "press"; button: PauseButton }
  /** Pointer: put the cursor on a row and activate it. */
  | { type: "activate"; row: PauseRow }
  /** Pointer: step a value row. */
  | { type: "cycle"; row: PauseRow; step: 1 | -1 };
