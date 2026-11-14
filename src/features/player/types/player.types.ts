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
  /** Aim direction from input (unnormalized; 0,0 = along facing). */
  aimX: number;
  aimY: number;
  /** Jump held on the previous step (edge detection for "pressed"). */
  prevJump: boolean;
}
