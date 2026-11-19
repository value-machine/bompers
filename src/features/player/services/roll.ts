import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import type { PlayerState, RollHoldButton, RollSource } from "@/features/player/types/player.types";

/**
 * Roll: the one rolling state of a blob, shared by every way into it (shared-roll D2).
 *
 * - **Hit:** any attack (dive strike, blast, later burn) applies its own knockback, then calls
 *   `reactToHit` with the impulse it gave. The impulse sets how long the blob is out of control
 *   (`roll.lockPerImpulse`, capped): 0 does nothing, a shove a short roll, a big blast a long
 *   airborne one. No threshold (shared-roll D3).
 * - **Dash:** holding fire through a dive's travel rolls on with the dive's speed (the dive
 *   feature calls `startRoll` with source `dash`); letting go of the button that started the
 *   dive (fire, or jump for a jump dive) ends it.
 * - **Crouch:** crouched on the ground with one direction held and no fire for
 *   `roll.crouchRollDelay` (shorter is aiming or turning, crouch D4) rolls that way from at least
 *   `roll.crouchStartSpeed` (the controller calls `startRoll` with source `crouch`). Letting go of
 *   crouch ends it; at rest it ends like a hit roll, back into the crouch (crouch-roll R1–R3).
 *
 * While rolling the controller runs ball physics (`steerRoll` in the controller): gravity along
 * the ground (rolls down hills), rolling friction, weak steering; terrain impacts bounce by
 * restitution (`bounceRoll`). Exits: coming to rest, a jump once the lock ran out, releasing a
 * dash or crouch roll's button, respawn, or `roll.maxSeconds`. The spin (`rollAngle`) is sim
 * state, so the look follows the physics; after a roll the body turns back upright.
 *
 * Held weapons sweep round with the spin (spin-fire D1): `weaponAim` is the stick aim turned by
 * `weaponSweep`, which follows the spin at most `roll.sweepTurnsPerSecond` and is 0 outside a roll.
 */
type RollTunables = GameTunables["roll"];

export const isRolling = (player: PlayerState): boolean => player.rollSource !== null;

/** Rolling and still out of control: no jump-out, weak steering. */
export const isRollLocked = (player: PlayerState): boolean =>
  isRolling(player) && player.rollLockSeconds > 0;

export interface StartRollArgs {
  source: RollSource;
  /** Velocity change that caused it, units / s (0 for a dash). Sets the lock time. */
  impulse?: Vec2;
  /** Least lock, seconds (a back hit). */
  minLockSeconds?: number;
  /** A dash: the button that keeps it going (default fire). A crouch roll is always held by crouch. */
  holdButton?: RollHoldButton;
}

/** What keeps a roll going: none for a hit, crouch for a crouch roll, the dive's button for a dash. */
function holdButtonOf(source: RollSource, holdButton?: RollHoldButton): RollHoldButton | null {
  if (source === "hit") return null;
  return source === "crouch" ? "crouch" : (holdButton ?? "fire");
}

/** Lock seconds for an impulse: linear in its strength, capped (shared-roll D3). */
export const rollLockFor = (impulse: Vec2, t: RollTunables): number =>
  Math.min(t.maxLockSeconds, Math.hypot(impulse.x, impulse.y) * t.lockPerImpulse);

/**
 * Puts the player into the roll (or refreshes a running one: the longer lock wins, a hit
 * overrides a dash so letting go of its button no longer ends it).
 */
export function startRoll(player: PlayerState, args: StartRollArgs, tunables: GameTunables): void {
  const lock = Math.max(
    rollLockFor(args.impulse ?? { x: 0, y: 0 }, tunables.roll),
    args.minLockSeconds ?? 0
  );
  if (!isRolling(player)) {
    player.rollSeconds = 0;
    player.rollSpin = 0;
    if (args.source !== "hit") player.moveRollCount += 1;
  }
  if (player.rollSource !== "hit") player.rollSource = args.source;
  player.rollHoldButton = holdButtonOf(player.rollSource, args.holdButton);
  player.rollLockSeconds = Math.max(player.rollLockSeconds, lock);
  player.crouching = false;
}

export function endRoll(player: PlayerState): void {
  if (!isRolling(player)) return;
  player.rollSource = null;
  player.weaponSweep = 0;
  player.rollHoldButton = null;
  player.rollLockSeconds = 0;
}

/** Respawn: no roll and upright at once. */
export function resetRoll(player: PlayerState): void {
  endRoll(player);
  player.rollAngle = 0;
  player.rollSpin = 0;
}

export interface HitReactionArgs {
  /** Velocity change the hit gave the player (already applied by the attack), units / s. */
  impulse: Vec2;
}

/**
 * The one call for attacks: rolls the player as hard as the hit pushed it. An impulse of 0
 * changes nothing. Returns whether the player is rolling from this hit.
 */
export function reactToHit(
  player: PlayerState,
  hit: HitReactionArgs,
  tunables: GameTunables
): boolean {
  if (Math.hypot(hit.impulse.x, hit.impulse.y) <= 0) return false;
  startRoll(player, { source: "hit", impulse: hit.impulse }, tunables);
  return true;
}

/** A dash or crouch roll lasts while its hold button (fire, jump for a jump dive, or crouch) is held. */
export function releaseRoll(player: PlayerState, input: PlayerInput): void {
  const button = player.rollHoldButton;
  if (button === null || player.rollSource === "hit") return;
  if (!input[button]) endRoll(player);
}

function bounceAxis(player: PlayerState, axis: "x" | "y", t: RollTunables): void {
  const direction = axis === "x" ? player.terrainHitX : player.terrainHitY;
  const speed = axis === "x" ? player.terrainHitSpeedX : player.terrainHitSpeedY;
  if (direction === 0 || speed < t.minBounceSpeed) return;
  const rebound = -direction * speed * t.restitution;
  // The surface also scrubs off some of the speed along it.
  player.vx = axis === "x" ? rebound : player.vx * t.surfaceSpeedKeep;
  player.vy = axis === "y" ? rebound : player.vy * t.surfaceSpeedKeep;
  if (axis === "y") player.grounded = false;
  player.rollBounceCount += 1;
  player.lastRollBounceSpeed = speed;
}

/**
 * Called by the controller right after terrain collision: a rolling blob that hit terrain
 * fast enough bounces off it by restitution, so bounces die out by themselves (D4).
 */
export function bounceRoll(player: PlayerState, tunables: GameTunables): void {
  if (!isRolling(player)) return;
  bounceAxis(player, "x", tunables.roll);
  bounceAxis(player, "y", tunables.roll);
}

/** Wraps an angle into (−π, π]. */
const wrapAngle = (angle: number): number => {
  const turn = Math.PI * 2;
  const wrapped = angle - turn * Math.round(angle / turn);
  return wrapped <= -Math.PI ? wrapped + turn : wrapped;
};

/**
 * Spin: on the ground it follows the speed (a ball, no slip); in the air it keeps its rate. A roll
 * that starts in the air (a dash out of a dive, a blast) has no rate yet: it takes one from its
 * speed, or it would hang frozen until it lands (owner bug report, roll-spin-bounce, 2026-11-18).
 */
function spin(player: PlayerState, dt: number): void {
  if (player.grounded || player.rollSpin === 0) {
    const radius = player.width / 2;
    const direction = Math.sign(player.vx) || player.facing;
    player.rollSpin = (direction * Math.hypot(player.vx, player.vy)) / radius;
  }
  player.rollAngle = wrapAngle(player.rollAngle + player.rollSpin * dt);
}

/** Held weapons turn with the spin, capped so a beam sweeps less than its width per step (D2). */
function sweepWeapon(player: PlayerState, t: RollTunables, dt: number): void {
  const cap = t.sweepTurnsPerSecond * Math.PI * 2;
  const rate = Math.sign(player.rollSpin) * Math.min(Math.abs(player.rollSpin), cap);
  player.weaponSweep = wrapAngle(player.weaponSweep + rate * dt);
}

/**
 * The unit direction held weapons fire in: the stick aim, turned by the roll's sweep (clockwise,
 * y down). Equal to the aim outside a roll.
 */
export function weaponAim(player: PlayerState): Vec2 {
  const turn = player.weaponSweep;
  if (turn === 0) return { x: player.aimX, y: player.aimY };
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return { x: player.aimX * cos - player.aimY * sin, y: player.aimX * sin + player.aimY * cos };
}

/** After a roll the body turns back upright the short way. */
function standUp(player: PlayerState, t: RollTunables, dt: number): void {
  const angle = wrapAngle(player.rollAngle);
  const step = t.standUpSpeed * dt;
  player.rollAngle = Math.abs(angle) <= step ? 0 : angle - Math.sign(angle) * step;
  player.rollSpin = 0;
}

/**
 * A hit or crouch roll is over when the lock ran out and the blob rests on the ground (a dash
 * lasts while its button is held).
 */
const atRest = (player: PlayerState, t: RollTunables): boolean =>
  player.rollSource !== "dash" &&
  player.rollSource !== null &&
  player.rollLockSeconds <= 0 &&
  player.grounded &&
  Math.hypot(player.vx, player.vy) < t.stopSpeed;

/** Per step after motion: lock and time, spin, and the rest / time-out exits. */
export function tickRoll(player: PlayerState, tunables: GameTunables, dt: number): void {
  const t = tunables.roll;
  if (!isRolling(player)) {
    if (player.rollAngle !== 0) standUp(player, t, dt);
    return;
  }
  player.rollLockSeconds = Math.max(0, player.rollLockSeconds - dt);
  player.rollSeconds += dt;
  spin(player, dt);
  sweepWeapon(player, t, dt);
  if (atRest(player, t)) {
    player.rollRestCount += 1;
    endRoll(player);
  } else if (player.rollSeconds >= t.maxSeconds) endRoll(player);
}
