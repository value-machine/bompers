import type { Vec2 } from "@/shared/types/gameGeometry.types";

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
  /**
   * Height hits see while crouched (crouch-sink D4): the blob hides low under its helmet, so the
   * hurt box (`hurtBox`) keeps `player.crouch.hurtHeightScale` of `height`. Fixed per player.
   */
  crouchHeight: number;
  grounded: boolean;
  /** Last horizontal direction moved: -1 left, 1 right. */
  facing: -1 | 1;
  /**
   * Aim direction as a unit vector (y down). Falls back to (facing, 0) when there is no aim
   * input. The helmet (eyes, later the rocket tube) points along it.
   */
  aimX: number;
  aimY: number;
  /** The stick / keys gave an aim direction this step (false = the facing fallback above). */
  aimHeld: boolean;
  /** Jump held on the previous step (edge detection for "pressed"). */
  prevJump: boolean;
  /** True from a jump's take-off until release or apex: releasing then cuts the rise. */
  jumpRising: boolean;
  /** Seconds left in which a ground jump still counts after leaving the ground (coyote). */
  coyoteTimer: number;
  /** Seconds left in which a recent jump press still fires (jump buffer). */
  jumpBufferTimer: number;
  /** The current jump press was already counted in `airJumpPressCount` (one count per press). */
  jumpPressCounted: boolean;
  /**
   * Horizontal speed a jump out of a roll carries (roll carry, double-jump-bash D11): while the
   * stick holds along `vx`, air steering bleeds speed above run speed at `roll.airCarryDecel`
   * down from here instead of steering it to run speed. 0 = no carry.
   */
  airCarrySpeed: number;
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
   * speed are render events (squash, shake, sound): move-roll starts (dash, crouch), hit rolls that came to
   * rest, terrain bounces. `weaponSweep` is how far held weapons have swept round from the aim
   * with the spin (radians, clockwise; 0 when not rolling; spin-fire D1, D2).
   */
  rollSource: RollSource | null;
  /**
   * A dash or crouch roll lasts while this button is held (the one that started its dive, or
   * crouch); null otherwise.
   */
  rollHoldButton: RollHoldButton | null;
  rollLockSeconds: number;
  rollSeconds: number;
  rollAngle: number;
  rollSpin: number;
  weaponSweep: number;
  moveRollCount: number;
  rollRestCount: number;
  rollBounceCount: number;
  lastRollBounceSpeed: number;
  /**
   * Defensive crouch (grounded + crouch held, not rolling or ability-steered): the blob stands
   * still and combat halves the damage it takes. `crouchCount` counts crouch starts (render).
   */
  crouching: boolean;
  crouchCount: number;
  /**
   * Crouch roll wind-up (crouch-roll R1): seconds crouched with one direction held and no fire;
   * at `roll.crouchRollDelay` the roll starts. 0 whenever that hold breaks.
   */
  crouchRollSeconds: number;
  /** Top of the first surface below the feet within shadow range, or null (contact shadow). */
  groundBelowY: number | null;
  /**
   * Event counters (squash, sounds; the dive reads `airJumpPressCount`). Monotonic, so a reader
   * that skipped steps still sees every event by comparing with the last value it read.
   */
  jumpCount: number;
  /**
   * Air jump presses the controller did not use: no ground, coyote or wall jump, and no ground
   * near enough for the landing buffer (double-jump-bash D2, D3). The dive treats each as a request.
   */
  airJumpPressCount: number;
  wallJumpCount: number;
  landCount: number;
  /**
   * Seconds since the feet last touched the ground (0 while grounded). A touchdown only counts as
   * a landing after `LANDING_MIN_AIR_SECONDS` in the air, so a contact that flips off and on for a
   * step or two (a steep lip, a moving part under the feet) never reads as a landing.
   */
  airSeconds: number;
  /** Downward speed at the last landing, units / s (scales the landing squash). */
  lastLandingSpeed: number;
  /** Slope under the feet while grounded, radians (+ = rising to the right); 0 in the air. */
  groundAngle: number;
  /**
   * The velocity the ground gave the body on its last grounded step (along the ground there).
   * Only velocity added on top of it can push the body off the ground: where the ground under
   * the feet changed since (a moving part slid away beside it), the old ground velocity is no push.
   */
  groundVelocity: Vec2;
  /**
   * Squeezed by a moving part into a gap narrower than the body, but not crushed (owner,
   * moving-parts lap B-2): the collision circle shrinks to `scale` × its radius so the blob still
   * moves and jumps, and the renderer squashes it to fit across the squeeze direction `nx, ny`.
   * Set by the movers step each sim step; null when free.
   */
  squeeze: { scale: number; nx: number; ny: number } | null;
}

/**
 * Why a blob rolls: knocked by a hit (any attack), rolling on from a held dash, or a crouch held
 * toward one side (crouch-roll R1).
 */
export type RollSource = "hit" | "dash" | "crouch";

/** The button that keeps a dash or crouch roll going (the one that started its dive, or crouch). */
export type RollHoldButton = "fire" | "jump" | "crouch";
