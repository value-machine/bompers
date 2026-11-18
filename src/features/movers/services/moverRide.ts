import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { MOTION_LIMITS, motionPose, posePoint, unposePoint } from "@/shared/utils/levelMotion";
import {
  fieldDistanceAt,
  fieldNormalAt,
  moverDistanceAt,
  type MoverBody,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";

/**
 * Moving parts in the sim (LEVEL_FORMAT § 11, moving-parts D7, D11, D12). Each step, before the
 * bodies move on their own: the parts take their pose for the sim time (a pure function of time,
 * so restarts replay exactly), then every riding body is carried by the motion of the point it
 * stands on (rotation included), and a part running into a body pushes it out along its motion.
 * A body that cannot get free (squeezed against static terrain or another part) is reported as
 * pinned; what happens to it is the crush rule (moving-parts lap B-2).
 */

/** A body that rides moving parts: its feet point (bottom-centre) and size, mutated in place. */
export interface RiderBody {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A part this close under the feet (world units) carries the body. */
const CARRY_CONTACT = 2;
/** Push-out steps along the part's normal before a body counts as squeezed. */
const PUSH_STEPS = 8;
/** Overlap with terrain up to this deep after the push is just contact (resting, touching). */
const SQUEEZE_SLOP = 1;

/** Sets every part's pose for sim time `timeSeconds` and keeps last step's pose for the carry. */
export function stepMoverPoses(terrain: TerrainGrid, timeSeconds: number): void {
  for (const mover of terrain.movers) {
    mover.prevPose = mover.pose;
    mover.pose = motionPose(mover.motion, timeSeconds);
  }
}

/** Where the part moved the point `p` this step (last pose → this pose). */
export function moverDisplacement(mover: MoverBody, p: Vec2): Vec2 {
  const now = posePoint(mover.pose, mover.pivot, unposePoint(mover.prevPose, mover.pivot, p));
  return { x: now.x - p.x, y: now.y - p.y };
}

const centerOf = (body: RiderBody): Vec2 => ({ x: body.x, y: body.y - body.height / 2 });

function shift(body: RiderBody, by: Vec2): void {
  body.x += by.x;
  body.y += by.y;
}

/** Unit normal pointing out of the part at `p` (straight up where it is flat). */
function moverNormal(mover: MoverBody, p: Vec2): Vec2 {
  const h = mover.field.cellSize / 2;
  const gx =
    moverDistanceAt(mover, { x: p.x + h, y: p.y }) - moverDistanceAt(mover, { x: p.x - h, y: p.y });
  const gy =
    moverDistanceAt(mover, { x: p.x, y: p.y + h }) - moverDistanceAt(mover, { x: p.x, y: p.y - h });
  const length = Math.hypot(gx, gy);
  return length < 1e-9 ? { x: 0, y: -1 } : { x: -gx / length, y: -gy / length };
}

/** The part the body stood on last step and how far it carried the body; null when none. */
function carry(terrain: TerrainGrid, body: RiderBody): { mover: MoverBody; by: Vec2 } | null {
  const feet = { x: body.x, y: body.y + 1 };
  const under = terrain.movers.find(
    (mover) => moverDistanceAt(mover, feet, mover.prevPose) > -CARRY_CONTACT
  );
  if (!under) return null;
  const by = moverDisplacement(under, { x: body.x, y: body.y });
  shift(body, by);
  return { mover: under, by };
}

/** Moves the body with a part it overlaps, then out along the part's normal. */
function pushOut(mover: MoverBody, body: RiderBody): boolean {
  const radius = body.width / 2;
  if (moverDistanceAt(mover, centerOf(body)) <= -radius) return false;
  shift(body, moverDisplacement(mover, centerOf(body)));
  for (let i = 0; i < PUSH_STEPS; i += 1) {
    const center = centerOf(body);
    const depth = moverDistanceAt(mover, center) + radius;
    if (depth <= 0) return true;
    const normal = moverNormal(mover, center);
    shift(body, { x: normal.x * (depth + 0.01), y: normal.y * (depth + 0.01) });
  }
  return true;
}

/** A body squeezed between a part and terrain: which part, and its normal toward the body. */
export interface PinnedBody {
  index: number;
  mover: number;
  nx: number;
  ny: number;
}

/** A body squeezed into a gap narrower than itself but still alive: its size scale and the squeeze axis. */
export interface Squeeze {
  /** Gap ÷ body width, in (lethal fraction, 1). */
  scale: number;
  nx: number;
  ny: number;
}

/** What one `rideMovers` call did, per body index. */
export interface RideResult {
  /** Bodies squeezed into a gap below the lethal fraction (crushed), for the crush rule. */
  pinned: PinnedBody[];
  /** Bodies squeezed but alive (null = free): they squash to fit and recover. */
  squeezed: (Squeeze | null)[];
  /** How far a part carried each body this step (null = not riding). */
  carried: (Vec2 | null)[];
}

/** How narrow a gap may get, as a fraction of the body width, before it crushes. */
export interface RideOptions {
  crushGapFraction: number;
}

/** The part let go (the gap opened): the body steps back out of the terrain at full size. */
function stepOut(terrain: TerrainGrid, body: RiderBody, overlap: number): null {
  const out = fieldNormalAt(terrain, centerOf(body));
  shift(body, { x: out.x * overlap, y: out.y * overlap });
  return null;
}

/**
 * A body still overlapping terrain after the carry and pushes is squeezed between the part that
 * pushed it and the terrain beyond (owner, lap B-2): the gap left is its width minus the overlap.
 * A gap under the lethal fraction crushes it; a wider one centres it in the gap and reports a
 * squeeze (the body shrinks to fit for its own step and recovers when the gap opens).
 */
function squeezeOf(
  terrain: TerrainGrid,
  body: RiderBody,
  at: { index: number; mover: MoverBody | null; options: RideOptions }
): { pinned: PinnedBody } | { squeeze: Squeeze } | null {
  const center = centerOf(body);
  const radius = body.width / 2;
  const overlap = fieldDistanceAt(terrain, center) + radius;
  if (overlap <= SQUEEZE_SLOP) return null;
  if (!at.mover) return stepOut(terrain, body, overlap);
  const normal = moverNormal(at.mover, center);
  const gap = body.width - overlap;
  if (gap < body.width * at.options.crushGapFraction) {
    const mover = terrain.movers.indexOf(at.mover);
    return { pinned: { index: at.index, mover, nx: normal.x, ny: normal.y } };
  }
  // Centre the body in the gap: half the overlap back toward the part.
  shift(body, { x: -normal.x * (overlap / 2), y: -normal.y * (overlap / 2) });
  // A little smaller than the gap, so the shrunken body can slide and jump along both faces.
  const scale = Math.max(0.05, (gap - SQUEEZE_SLOP * 2) / body.width);
  return { squeeze: { scale, nx: normal.x, ny: normal.y } };
}

/** Carries and pushes every body (call after `stepMoverPoses`, before the bodies' own step). */
export function rideMovers(
  terrain: TerrainGrid,
  bodies: readonly RiderBody[],
  options: RideOptions
): RideResult {
  const result: RideResult = {
    pinned: [],
    squeezed: bodies.map(() => null),
    carried: bodies.map(() => null),
  };
  if (terrain.movers.length === 0) return result;
  bodies.forEach((body, index) => rideOne(terrain, { body, index, options, result }));
  return result;
}

/** Every part but the one carrying the body pushes it; the last that did (else the carrier). */
function pushByOthers(
  terrain: TerrainGrid,
  body: RiderBody,
  carrier: MoverBody | null
): MoverBody | null {
  let pusher = carrier;
  for (const mover of terrain.movers) {
    if (mover !== carrier && pushOut(mover, body)) pusher = mover;
  }
  return pusher;
}

/** One body: carry, push, then squeeze or crush; written into `result` at `index`. */
function rideOne(
  terrain: TerrainGrid,
  step: { body: RiderBody; index: number; options: RideOptions; result: RideResult }
): void {
  const { body, index, options, result } = step;
  const riding = carry(terrain, body);
  result.carried[index] = riding?.by ?? null;
  const pusher = pushByOthers(terrain, body, riding?.mover ?? null);
  const squeezed = squeezeOf(terrain, body, { index, mover: pusher, options });
  if (!squeezed) return;
  if ("pinned" in squeezed) result.pinned.push(squeezed.pinned);
  else result.squeezed[index] = squeezed.squeeze;
}

// ── Leaving a part (moving parts lap B-2, orchestrator via owner) ───────────

/** A riding body that keeps its own velocity (units/s): players, crates. */
export interface MovingRider extends RiderBody {
  id: string;
  vx: number;
  vy: number;
}

/** Each body's carry velocity last step (units/s), by id. */
export type CarryMemory = ReadonlyMap<string, Vec2>;

/** The part's velocity a body keeps, capped at the ride speed so a spinner can't fling anyone. */
export function leaveVelocity(v: Vec2): Vec2 {
  const speed = Math.hypot(v.x, v.y);
  const cap = MOTION_LIMITS.rideSpeed;
  return speed <= cap ? v : { x: (v.x / speed) * cap, y: (v.y / speed) * cap };
}

/**
 * A body that rode a part last step and no longer does (it jumped, dived or walked off) keeps
 * the part's velocity once, capped (`leaveVelocity`). Returns this step's memory.
 */
export function inheritOnLeave(
  memory: CarryMemory,
  bodies: readonly MovingRider[],
  step: { ride: RideResult; dt: number }
): CarryMemory {
  const next = new Map<string, Vec2>();
  bodies.forEach((body, index) => {
    const by = step.ride.carried[index];
    if (by) {
      next.set(body.id, { x: by.x / step.dt, y: by.y / step.dt });
      return;
    }
    const last = memory.get(body.id);
    if (!last) return;
    const keep = leaveVelocity(last);
    body.vx += keep.x;
    body.vy += keep.y;
  });
  return next;
}
