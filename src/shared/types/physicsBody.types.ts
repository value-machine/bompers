/**
 * A physics object's body as data (physics-objects lap): written by the object registry
 * (`level-objects` recipes) and simulated and drawn by `physics-objects` (round bodies) and
 * `karts` (the kart lap).
 */

/** Colours a physics object's look picks from (`GAME_PALETTE.objectPanels`). */
export type ObjectPanelColor = "cream" | "rose" | "frost" | "sun";

/** What every round body shares (weights in blobs: a blob = 1). */
interface RoundBodyFeel {
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
}

/**
 * How a ball behaves and looks, as data: a new variant is one more line, no code (owner,
 * physics-objects pick).
 */
export interface BallBodySpec extends RoundBodyFeel {
  shape: "ball";
  /** Panel colours around the ball, drawn as equal wedges. */
  panels: readonly ObjectPanelColor[];
}

/** One wheel of a kart: a round body with the kart's feel and half its weight (kart lap K2). */
export interface WheelBodySpec extends RoundBodyFeel {
  shape: "wheel";
}

/**
 * How a kart behaves and looks, as data (owner, kart Q1: variants as data lines). `mass` is the
 * whole kart (each wheel carries half); the feel fields apply to its wheels. Sizes are shares of
 * the placed box (width = length, height = overall height).
 */
export interface KartBodySpec extends RoundBodyFeel {
  shape: "kart";
  /** Wheel radius, × box height. */
  wheelRadius: number;
  /** Wheel centres from the kart's middle, × box width. */
  wheelSpread: number;
  /** Chassis thickness, × box height. */
  chassisHeight: number;
  /** Top speed driving on the flat, units / s. */
  driveSpeed: number;
  /** Speed gained per second toward the stick's speed, units / s². */
  driveAccel: number;
  /** Upward speed of a hop, units / s. */
  hopSpeed: number;
  /** Chassis spring: angular frequency (rad / s) and damping ratio (springy below 1). */
  springRate: number;
  springDamping: number;
  /** Body and trim colours. */
  body: ObjectPanelColor;
  trim: ObjectPanelColor;
}

/** A placed physics variant's body (a kind's recipe line). */
export type PhysicsBodySpec = BallBodySpec | KartBodySpec;

/** A body the physics-objects feature simulates as a circle. */
export type RoundBodySpec = BallBodySpec | WheelBodySpec;
