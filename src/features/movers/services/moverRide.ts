import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { motionPose, posePoint, unposePoint } from "@/shared/utils/levelMotion";
import {
  fieldDistanceAt,
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
/** Push-out steps along the part's normal before a body counts as pinned. */
const PUSH_STEPS = 8;
/** Overlap with all terrain deeper than this after the push = pinned. */
const PINNED_DEPTH = 1;

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

/** The part the body stood on last step, after carrying the body with it; null when none. */
function carry(terrain: TerrainGrid, body: RiderBody): MoverBody | null {
  const feet = { x: body.x, y: body.y + 1 };
  const under = terrain.movers.find(
    (mover) => moverDistanceAt(mover, feet, mover.prevPose) > -CARRY_CONTACT
  );
  if (!under) return null;
  shift(body, moverDisplacement(under, { x: body.x, y: body.y }));
  return under;
}

/** Moves the body with a part it overlaps, then out along the part's normal. */
function pushOut(mover: MoverBody, body: RiderBody): void {
  const radius = body.width / 2;
  if (moverDistanceAt(mover, centerOf(body)) <= -radius) return;
  shift(body, moverDisplacement(mover, centerOf(body)));
  for (let i = 0; i < PUSH_STEPS; i += 1) {
    const center = centerOf(body);
    const depth = moverDistanceAt(mover, center) + radius;
    if (depth <= 0) return;
    const normal = moverNormal(mover, center);
    shift(body, { x: normal.x * (depth + 0.01), y: normal.y * (depth + 0.01) });
  }
}

/**
 * Carries and pushes every body (call after `stepMoverPoses`, before the bodies' own step).
 * Returns the indices of bodies left overlapping terrain (pinned), for the crush rule.
 */
export function rideMovers(terrain: TerrainGrid, bodies: readonly RiderBody[]): number[] {
  if (terrain.movers.length === 0) return [];
  const pinned: number[] = [];
  bodies.forEach((body, index) => {
    const riding = carry(terrain, body);
    for (const mover of terrain.movers) if (mover !== riding) pushOut(mover, body);
    if (fieldDistanceAt(terrain, centerOf(body)) > -body.width / 2 + PINNED_DEPTH) {
      pinned.push(index);
    }
  });
  return pinned;
}
