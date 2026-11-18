/**
 * One player's simulation state. Position is the feet point (bottom-center of the body), so
 * spawn points and ground contact read naturally. y grows downward.
 */
export interface PlayerState {
  /** Stable id for render bookkeeping (`p<slot>`). */
  id: string;
  /** Input slot 0–3; also picks the player color. */
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  /** Last horizontal direction moved: -1 left, 1 right. */
  facing: -1 | 1;
  /**
   * Aim direction as a unit vector (y down). Falls back to (facing, 0) when there is no aim
   * input. The helmet (eyes, later the rocket tube) points along it.
   */
  aimX: number;
  aimY: number;
  /** Jump held on the previous step (edge detection for "pressed"). */
  prevJump: boolean;
  /** True from a jump's take-off until release or apex: releasing then cuts the rise. */
  jumpRising: boolean;
  /** Seconds left in which a ground jump still counts after leaving the ground (coyote). */
  coyoteTimer: number;
  /** Seconds left in which a recent jump press still fires (jump buffer). */
  jumpBufferTimer: number;
  /** Wall touching the body this step while airborne: -1 left, 1 right, 0 none. */
  wallDir: -1 | 0 | 1;
  /** Side of the last wall touched, and seconds left in which a wall-jump off it still counts. */
  lastWallDir: -1 | 1;
  wallCoyoteTimer: number;
  /** Seconds left of reduced steering after a wall-jump. */
  wallJumpLockTimer: number;
  /**
   * Motion modifiers, written by ability systems (the dive; later stuns or recoil) and read by
   * the controller on the next step. Defaults 1 / 1 / false = plain movement.
   */
  /** Scales input steering and braking: 0 keeps the current horizontal velocity untouched. */
  steerScale: number;
  gravityScale: number;
  /** A buffered jump does not fire while set. */
  jumpLocked: boolean;
  /**
   * Terrain hit on this step, per axis: direction of the blocked move (-1 / 1, 0 = none) and the
   * speed it had before the controller zeroed it. Lets ability systems bounce or stun.
   */
  terrainHitX: -1 | 0 | 1;
  terrainHitY: -1 | 0 | 1;
  terrainHitSpeedX: number;
  terrainHitSpeedY: number;
  /**
   * Roll (`services/roll.ts`, shared-roll D2): what started it (`null` = not rolling), seconds
   * of lock left (no jump-out, weak steering) and seconds rolled. `rollAngle` is the body's spin
   * (radians, eases back upright after a roll) and `rollSpin` its rate. Counters and the bounce
   * speed are render events (squash, shake, sound): dash-roll starts, hit rolls that came to
   * rest, terrain bounces.
   */
  rollSource: RollSource | null;
  rollLockSeconds: number;
  rollSeconds: number;
  rollAngle: number;
  rollSpin: number;
  dashRollCount: number;
  rollRestCount: number;
  rollBounceCount: number;
  lastRollBounceSpeed: number;
  /**
   * Defensive crouch (grounded + crouch held, not rolling or ability-steered): the blob stands
   * still and combat halves the damage it takes. `crouchCount` counts crouch starts (render).
   */
  crouching: boolean;
  crouchCount: number;
  /** Top of the first surface below the feet within shadow range, or null (contact shadow). */
  groundBelowY: number | null;
  /**
   * Event counters for the render layer (squash, sounds). Monotonic, so a frame that ran
   * several sim steps still sees every event by comparing with the last value it read.
   */
  jumpCount: number;
  wallJumpCount: number;
  landCount: number;
  /** Downward speed at the last landing, units / s (scales the landing squash). */
  lastLandingSpeed: number;
  /** Slope under the feet while grounded, radians (+ = rising to the right); 0 in the air. */
  groundAngle: number;
  /**
   * Squeezed by a moving part into a gap narrower than the body, but not crushed (owner,
   * moving-parts lap B-2): the collision circle shrinks to `scale` × its radius so the blob still
   * moves and jumps, and the renderer squashes it to fit across the squeeze direction `nx, ny`.
   * Set by the movers step each sim step; null when free.
   */
  squeeze: { scale: number; nx: number; ny: number } | null;
}

/** Why a blob rolls: knocked by a hit (any attack) or rolling on from a held dash. */
export type RollSource = "hit" | "dash";
