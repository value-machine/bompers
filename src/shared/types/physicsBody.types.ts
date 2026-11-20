/**
 * A physics object's body as data (physics-objects lap): written by the object registry
 * (`level-objects` recipes) and simulated and drawn by `physics-objects`.
 */

/** Colours a physics object's look picks from (`GAME_PALETTE.objectPanels`). */
export type ObjectPanelColor = "cream" | "rose" | "frost" | "sun";

/**
 * How a physics variant behaves and looks, as data: a new variant is one more line, no code
 * (owner, physics-objects pick). Weights are in blobs (a blob = 1).
 */
export interface PhysicsBodySpec {
  /** Body shape the physics-objects feature simulates and draws (a car later adds its own). */
  shape: "ball";
  /** Weight in blobs: pushes and bumps divide by it. */
  mass: number;
  /** Bounce, 0–1: share of the speed into a surface it keeps coming off it. */
  restitution: number;
  /** Rolling speed lost per second, as a fraction (0 = rolls forever). */
  rollDrag: number;
  /** Seconds a burning object burns before it burns through and pops; null = never burns. */
  burnSeconds: number | null;
  /** Catalog sound played on a bounce. */
  bounceSound: string;
  /** Panel colours around the ball, drawn as equal wedges. */
  panels: readonly ObjectPanelColor[];
}
