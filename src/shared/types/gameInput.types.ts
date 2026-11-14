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

/** Where a slot's input comes from. */
export type InputSource =
  | { kind: "keyboard"; layout: KeyboardLayoutId }
  | { kind: "gamepad"; padIndex: number };

export type KeyboardLayoutId = "left" | "right";

/** A plain snapshot of one gamepad (the subset of the Gamepad API the mapping needs). */
export interface GamepadSnapshot {
  axes: readonly number[];
  /** Pressed state per standard-mapping button index. */
  buttons: readonly boolean[];
}
