/**
 * One player's input for one fixed step — a plain value, so the simulation never sees the DOM.
 * Produced by `gameInputService` (keyboard halves + Gamepad API), consumed by sim systems.
 */
export interface PlayerInput {
  /** The device behind this slot is present (keyboard halves always are). */
  connected: boolean;
  /** Horizontal move, -1 (left) … 1 (right). */
  moveX: number;
  /** Aim direction (unnormalized; 0,0 means "use facing"). y is down-positive like the world. */
  aimX: number;
  aimY: number;
  /** Held state; the sim derives "pressed this step" from its own previous value. */
  jump: boolean;
  fire: boolean;
  /**
   * Pause / Start (pad Start, keyboard Escape). Not used by the sim; a pause menu reads the
   * press edge per slot like `jump`.
   */
  pause: boolean;
  /**
   * Down on the move control (keyboard down, d-pad down, move stick mostly down). Crouches only
   * on the ground; in the air down is just aim (`aimY`).
   */
  crouch: boolean;
  /**
   * Respawn on purpose (owner, never-stuck: the fallback when a blob is really stuck), held:
   * keyboard Q / Backspace, pad Back (View / Select). It counts only after a full hold
   * (`match.selfRespawnHoldSeconds`), so a stray press does nothing.
   */
  respawn: boolean;
}

/** Inputs for all player slots, index = slot (0–3). */
export type PlayerInputs = readonly PlayerInput[];

/** Where a slot's input comes from (an input device: one keyboard half or one gamepad). */
export type InputSource =
  | { kind: "keyboard"; layout: KeyboardLayoutId }
  | { kind: "gamepad"; padIndex: number };

/** Per-slot sources for a match; null = nobody in that slot (always disconnected). */
export type SlotSources = readonly (InputSource | null)[];

/**
 * One device's menu buttons (lobby and round-end screens), held state. Edges are derived by
 * the consumer from its previous sample, like the sim does for `PlayerInput`.
 */
export interface MenuInput {
  /** The device is there (keyboard halves always are; a gamepad only while connected). */
  present: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Join / choose / start. */
  confirm: boolean;
  /** Leave / back to the lobby. */
  back: boolean;
}

export type KeyboardLayoutId = "left" | "right";

/** A plain snapshot of one gamepad (the subset of the Gamepad API the mapping needs). */
export interface GamepadSnapshot {
  /** Left stick x, y then right stick x, y (standard mapping), each -1 … 1. */
  axes: readonly number[];
  /** Pressed state per standard-mapping button index. */
  buttons: readonly boolean[];
}
