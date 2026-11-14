import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Tumble: the hurt reaction to a hard hit. The blob is out of control for a moment and
 * ricochets off floors and walls like a rubber ball: a few bounces, each weaker than the last,
 * with little steering and no jump, then it recovers. Any attack can trigger it (the dive's
 * strike, a rocket blast): the attack applies its own knockback velocity, then calls
 * `reactToHit` with the impulse it gave. Lighter hits change nothing here.
 *
 * State lives on `PlayerState` (`tumbleSeconds`, `tumbleBouncesLeft`, `tumbleBounceCount`); the
 * controller calls `bounceTumble` / `tickTumble` each step.
 */
type TumbleTunables = GameTunables["tumble"];

export const isTumbling = (player: PlayerState): boolean => player.tumbleSeconds > 0;

/** Puts the player into a tumble with a full set of bounces (restarts a running one). */
export function startTumble(player: PlayerState, tunables: GameTunables): void {
  player.tumbleSeconds = tunables.tumble.maxSeconds;
  player.tumbleBouncesLeft = tunables.tumble.bounces;
  player.grounded = false;
}

export function endTumble(player: PlayerState): void {
  player.tumbleSeconds = 0;
  player.tumbleBouncesLeft = 0;
}

export interface HitReactionArgs {
  /** Velocity change the hit gave the player (already applied by the attack), units / s. */
  impulse: Vec2;
  /** Force the hard reaction whatever the impulse (e.g. a hit in the back). */
  hard?: boolean;
}

/**
 * The one call for attacks: starts a tumble when the hit was hard (`hard`, or an impulse of at
 * least `tumble.minImpulse`). Returns whether the player is now tumbling from this hit.
 */
export function reactToHit(
  player: PlayerState,
  hit: HitReactionArgs,
  tunables: GameTunables
): boolean {
  const strength = Math.hypot(hit.impulse.x, hit.impulse.y);
  if (hit.hard !== true && strength < tunables.tumble.minImpulse) return false;
  startTumble(player, tunables);
  return true;
}

/** Bounciness of the next bounce: each one is weaker than the last. */
const nextRestitution = (player: PlayerState, t: TumbleTunables): number =>
  t.restitution * t.restitutionDecay ** (t.bounces - player.tumbleBouncesLeft);

function bounceAxis(player: PlayerState, axis: "x" | "y", t: TumbleTunables): void {
  const direction = axis === "x" ? player.terrainHitX : player.terrainHitY;
  const speed = axis === "x" ? player.terrainHitSpeedX : player.terrainHitSpeedY;
  if (direction === 0 || speed < t.minBounceSpeed || player.tumbleBouncesLeft <= 0) return;
  const rebound = -direction * speed * nextRestitution(player, t);
  // The surface also scrubs off some of the speed along it, so a tumble dies out.
  player.vx = axis === "x" ? rebound : player.vx * t.surfaceSpeedKeep;
  player.vy = axis === "y" ? rebound : player.vy * t.surfaceSpeedKeep;
  if (axis === "y") player.grounded = false;
  player.tumbleBouncesLeft -= 1;
  player.tumbleBounceCount += 1;
  player.lastTumbleBounceSpeed = speed;
}

/**
 * Called by the controller right after terrain collision: a tumbling blob that hit terrain
 * hard enough bounces off it instead of stopping. Coming to rest on the ground ends the tumble.
 */
export function bounceTumble(player: PlayerState, tunables: GameTunables): void {
  if (!isTumbling(player)) return;
  bounceAxis(player, "x", tunables.tumble);
  bounceAxis(player, "y", tunables.tumble);
  if (player.grounded) endTumble(player);
}

/** Counts the tumble down; it also ends by time, so nobody stays helpless. */
export function tickTumble(player: PlayerState, dt: number): void {
  if (!isTumbling(player)) return;
  player.tumbleSeconds = Math.max(0, player.tumbleSeconds - dt);
  if (player.tumbleSeconds === 0) endTumble(player);
}
