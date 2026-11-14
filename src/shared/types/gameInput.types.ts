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
  axes: readonly number[];
  /** Pressed state per standard-mapping button index. */
  buttons: readonly boolean[];
}
