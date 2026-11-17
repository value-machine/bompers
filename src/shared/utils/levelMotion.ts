import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import type { LevelMotion, MotionKind, MotionPose } from "@/shared/types/levelMotion.types";

/**
 * Moving-part motion (LEVEL_FORMAT § 11, moving-parts D3–D7): the defaults and limits of the
 * `data-motion` grammar and the one pose function every reader uses. Pure: pose = f(motion,
 * time), so restarts and replays agree.
 *
 * SECOND COPY: public/level-kit/v2/preview.js repeats the grammar defaults and the pose maths in
 * plain browser JS (it cannot import TypeScript). Change both together.
 */

export const MOTION_KINDS: readonly MotionKind[] = ["slide", "path", "spin", "swing"];

export const MOTION_DEFAULTS = {
  periodS: 4,
  phase: 0,
  /** Named pivot per kind when the file names none. */
  pivot: { spin: "center", swing: "top" },
} as const;

export const MOTION_LIMITS = {
  minPeriodS: 1,
  maxPeriodS: 30,
  maxSwingDegrees: 180,
  maxMovers: 16,
  /** Fastest surface a player can still ride: their run speed (units/s). */
  rideSpeed: DEFAULT_GAME_TUNABLES.player.runSpeed,
  /** A passing part keeps this far from a spawn point: half a player. */
  spawnClearance: DEFAULT_GAME_TUNABLES.player.width / 2,
} as const;

/** Named pivots: fractions of the part's bounding box (x, y), y down. */
export const MOTION_PIVOTS = {
  center: [0.5, 0.5],
  top: [0.5, 0],
  bottom: [0.5, 1],
  left: [0, 0.5],
  right: [1, 0.5],
  "top-left": [0, 0],
  "top-right": [1, 0],
  "bottom-left": [0, 1],
  "bottom-right": [1, 1],
} as const satisfies Record<string, readonly [number, number]>;

export type MotionPivotName = keyof typeof MOTION_PIVOTS;

export const isMotionPivotName = (name: string): name is MotionPivotName =>
  Object.prototype.hasOwnProperty.call(MOTION_PIVOTS, name);

/** The world point of a named pivot on a bounding box. */
export function pivotPoint(box: Rect, name: MotionPivotName): Vec2 {
  const [fx, fy] = MOTION_PIVOTS[name];
  return { x: box.x + box.w * fx, y: box.y + box.h * fy };
}

const TAU = Math.PI * 2;
const STILL: MotionPose = { dx: 0, dy: 0, angle: 0 };

/** Waypoints of a path loop, rest pose first and last. */
const loopPoints = (offsets: readonly Vec2[]): Vec2[] => [
  { x: 0, y: 0 },
  ...offsets,
  { x: 0, y: 0 },
];

/** Total length of a path loop. */
export function pathLength(offsets: readonly Vec2[]): number {
  const points = loopPoints(offsets);
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

/** The point a fraction `u` of the way round a path loop (constant speed). */
function pathOffset(offsets: readonly Vec2[], u: number): Vec2 {
  const points = loopPoints(offsets);
  let left = u * pathLength(offsets);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= seg && seg > 0) {
      const t = left / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= seg;
  }
  return { x: 0, y: 0 };
}

/** Fraction of the cycle at `timeS`, in [0, 1). */
const cycleAt = (motion: LevelMotion, timeS: number): number => {
  const u = (timeS / motion.periodS + motion.phase) % 1;
  return u < 0 ? u + 1 : u;
};

/** The part's pose at round time `timeS` (seconds). */
export function motionPose(motion: LevelMotion, timeS: number): MotionPose {
  if (!(motion.periodS > 0)) return STILL;
  const u = cycleAt(motion, timeS);
  switch (motion.kind) {
    case "slide": {
      const s = (1 - Math.cos(TAU * u)) / 2;
      return { dx: motion.offset.x * s, dy: motion.offset.y * s, angle: 0 };
    }
    case "path": {
      const p = pathOffset(motion.offsets, u);
      return { dx: p.x, dy: p.y, angle: 0 };
    }
    case "spin":
      return { dx: 0, dy: 0, angle: motion.direction * TAU * u };
    case "swing":
      return {
        dx: 0,
        dy: 0,
        angle: motion.direction * ((motion.degrees * Math.PI) / 180) * Math.sin(TAU * u),
      };
  }
}

/** Where rest-pose point `p` is in this pose (rotate about `pivot`, then shift). */
export function posePoint(pose: MotionPose, pivot: Vec2, p: Vec2): Vec2 {
  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  const x = p.x - pivot.x;
  const y = p.y - pivot.y;
  return {
    x: pivot.x + x * cos - y * sin + pose.dx,
    y: pivot.y + x * sin + y * cos + pose.dy,
  };
}

/** The rest-pose point that this pose moves onto world point `p` (inverse of `posePoint`). */
export function unposePoint(pose: MotionPose, pivot: Vec2, p: Vec2): Vec2 {
  return posePoint({ dx: 0, dy: 0, angle: -pose.angle }, pivot, {
    x: p.x - pose.dx,
    y: p.y - pose.dy,
  });
}

/**
 * Fastest speed (units/s) of any part point, given the farthest distance `reach` of the part's
 * shape from its pivot. Slide: π·|offset| / T; path: length / T; spin: 2π·reach / T;
 * swing: amplitude·2π / T · reach.
 */
export function motionPeakSpeed(motion: LevelMotion, reach: number): number {
  const T = motion.periodS;
  switch (motion.kind) {
    case "slide":
      return (Math.PI * Math.hypot(motion.offset.x, motion.offset.y)) / T;
    case "path":
      return pathLength(motion.offsets) / T;
    case "spin":
      return (TAU * reach) / T;
    case "swing":
      return (((motion.degrees * Math.PI) / 180) * TAU * reach) / T;
  }
}
