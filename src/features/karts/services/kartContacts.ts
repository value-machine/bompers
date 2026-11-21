import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import { moveAxis, type PlayerState } from "@/features/player/api/playerApi";
import { moveObjectSafely } from "@/features/physics-objects/api/physicsObjectsApi";
import {
  axleOf,
  chassisOf,
  nearestOnChassis,
  wheelRadiusOf,
} from "@/features/karts/services/kartBody";
import type { Kart, KartsState } from "@/features/karts/services/kartModel";

/**
 * Blobs and karts (kart lap K7, K8). The chassis is never terrain to a blob: a blob on top
 * stands on it (pushed out up, carried along, given a jump); from the side it is a bump by weight
 * in which the kart gives way first with terrain-safe moves of its wheels. A kart moving into a
 * blob faster than `karts.hitSpeed` (its speed at the start of the step, before bumps took any off)
 * hits it once per `karts.hitCooldownSeconds`; the match turns each hit into combat's `applyHit`.
 * The kart's own driver is never bumped or hit by it. Pure TS, mutates.
 */

/** A contact normal pointing up more than this (−y) means the blob is on top. */
const ON_TOP = 0.6;
/** Extra reach for a hit: a blob just bumped apart this step still counts. */
const HIT_REACH = 3;
/** Upward kick a rammed blob takes (units / s), so the hit lifts it like a headbutt. */
const RAM_LIFT = 180;

/** One kart hitting one blob this step, for combat's `applyHit` (kind contact, source kart). */
export interface KartHit {
  kartId: string;
  victim: PlayerState;
  /** The driver credited, or null for an empty kart rolling into someone. */
  attackerSlot: number | null;
  at: Vec2;
  /** Direction from the kart into the blob. */
  direction: Vec2;
  /** Velocity change the hit gave the blob (for `reactToHit`). */
  impulse: Vec2;
}

const blobCenter = (player: PlayerState): Vec2 => ({
  x: player.x,
  y: player.y - player.height / 2,
});

interface Touch {
  normal: Vec2;
  /** Overlap (positive) or gap (negative), world units. */
  overlap: number;
  at: Vec2;
  /** Touching the chassis (else a wheel). */
  chassis: boolean;
}

function unit(from: Vec2, to: Vec2): { normal: Vec2; distance: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return { normal: { x: 0, y: -1 }, distance: 0 };
  return { normal: { x: dx / distance, y: dy / distance }, distance };
}

/** The closest part of the kart to the blob: the chassis or a wheel, with the normal into the blob. */
function touchOf(kart: Kart, player: PlayerState): Touch {
  const center = blobCenter(player);
  const r = player.width / 2;
  const chassis = chassisOf(kart);
  const core = nearestOnChassis(chassis, center);
  const fromChassis = unit(core, center);
  let best: Touch = {
    normal: fromChassis.normal,
    overlap: chassis.radius + r - fromChassis.distance,
    at: core,
    chassis: true,
  };
  const wheelR = wheelRadiusOf(kart);
  for (const wheel of kart.wheels) {
    const fromWheel = unit(wheel, center);
    const overlap = wheelR + r - fromWheel.distance;
    if (overlap > best.overlap)
      best = { normal: fromWheel.normal, overlap, at: wheel, chassis: false };
  }
  return best;
}

export interface KartContactStep {
  terrain: TerrainGrid;
  tunables: GameTunables;
  now: number;
  dt: number;
}

/** One blob touching one kart. */
interface Pair {
  kart: Kart;
  player: PlayerState;
  touch: Touch;
}

/** A blob on top: out of the chassis upward, carried with it, and on "ground" for a jump. */
function standOn({ kart, player, touch }: Pair, step: KartContactStep): void {
  const contact = { terrain: step.terrain, slope: step.tunables.player.slope };
  const { velocity } = axleOf(kart);
  moveAxis(player, { axis: "y", delta: -touch.overlap }, contact);
  moveAxis(player, { axis: "x", delta: velocity.x * step.dt }, contact);
  if (player.vy > velocity.y) player.vy = velocity.y;
  player.coyoteTimer = step.tunables.player.coyoteTime;
}

/** Equal and opposite along the contact, by weight (a blob = 1, the kart its `mass`). */
function exchangeSpeed({ kart, player, touch }: Pair, tunables: GameTunables): void {
  const { normal } = touch;
  const mass = kart.body.mass;
  const { velocity } = axleOf(kart);
  const closing = (velocity.x - player.vx) * normal.x + (velocity.y - player.vy) * normal.y;
  if (closing <= 0) return;
  const impulse = ((1 + kart.body.restitution) * closing) / (1 + 1 / mass);
  const blobChange = Math.min(impulse, tunables.bodyCollision.maxImpulse);
  for (const wheel of kart.wheels) {
    wheel.vx -= (normal.x * impulse) / mass;
    wheel.vy -= (normal.y * impulse) / mass;
  }
  player.vx += normal.x * blobChange;
  player.vy += normal.y * blobChange;
}

/** From the side: the kart gives way first (both wheels, never into terrain), the blob takes the rest. */
function bumpAside(pair: Pair, step: KartContactStep): void {
  const { kart, player, touch } = pair;
  const { normal } = touch;
  exchangeSpeed(pair, step.tunables);
  const away = { x: -normal.x * touch.overlap, y: -normal.y * touch.overlap };
  const moved = Math.min(
    ...kart.wheels.map((wheel) => moveObjectSafely(wheel, away, step.terrain))
  );
  const left = touch.overlap - moved;
  if (left <= 1e-3) return;
  const contact = { terrain: step.terrain, slope: step.tunables.player.slope };
  moveAxis(player, { axis: "x", delta: normal.x * left }, contact);
  moveAxis(player, { axis: "y", delta: normal.y * left }, contact);
}

/** The kart ran into the blob fast enough: knock it like a headbutt and report the hit. */
function ram(
  karts: KartsState,
  ctx: { kart: Kart; player: PlayerState; touch: Touch; attackerSlot: number | null },
  step: KartContactStep
): KartHit | null {
  const { kart, player, touch } = ctx;
  const start = kart.stepStartVelocity;
  const speed = start.x * touch.normal.x + start.y * touch.normal.y;
  if (speed < step.tunables.karts.hitSpeed) return null;
  const key = `${kart.id}:${player.id}`;
  if (step.now < (karts.hitCooldowns.get(key) ?? -Infinity)) return null;
  karts.hitCooldowns.set(key, step.now + step.tunables.karts.hitCooldownSeconds);
  const along = player.vx * touch.normal.x + player.vy * touch.normal.y;
  const gain = Math.max(0, speed - along);
  const impulse = { x: touch.normal.x * gain, y: touch.normal.y * gain - RAM_LIFT };
  player.vx += impulse.x;
  player.vy += impulse.y;
  player.grounded = false;
  return {
    kartId: kart.id,
    victim: player,
    attackerSlot: ctx.attackerSlot,
    at: touch.at,
    direction: touch.normal,
    impulse,
  };
}

/**
 * Every blob against every kart in play: stand on top, bump aside, and the hits of karts moving
 * into blobs faster than `karts.hitSpeed`. `players` are the blobs in play that are not seated.
 */
export function bumpKartsAndBlobs(
  karts: KartsState,
  args: KartContactStep & {
    inPlay: readonly Kart[];
    players: readonly PlayerState[];
    slotOf: (id: string) => number | null;
  }
): KartHit[] {
  return args.inPlay.flatMap((kart) =>
    args.players.flatMap(
      (player) => meet(karts, { kart, player, touch: touchOf(kart, player) }, args) ?? []
    )
  );
}

/** One blob and one kart: a hit from the side when fast, then standing on it or a bump. */
function meet(
  karts: KartsState,
  pair: Pair,
  args: KartContactStep & { slotOf: (id: string) => number | null }
): KartHit | null {
  const { kart, touch } = pair;
  if (touch.overlap <= -HIT_REACH) return null;
  const onTop = touch.chassis && touch.normal.y < -ON_TOP;
  const attackerSlot = kart.driverId === null ? null : args.slotOf(kart.driverId);
  const hit = onTop ? null : ram(karts, { ...pair, attackerSlot }, args);
  // The wheels' own bump with blobs is physics-objects'; here only the chassis touches.
  if (touch.overlap > 0 && touch.chassis) {
    if (onTop) standOn(pair, args);
    else bumpAside(pair, args);
  }
  return hit;
}
