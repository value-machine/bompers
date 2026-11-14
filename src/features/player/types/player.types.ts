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
}
