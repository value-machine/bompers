import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { SampleField } from "@/shared/types/sampleFront.types";

/**
 * The ray fan of a spray weapon (fire-spread b1 D5–D7; shared by the torch and the freeze ray,
 * ice-element D4): `rays` rays fan out from `origin` over ±`halfAngleDegrees` of the aim, each
 * marching half a sample at a time up to `length`. A ray stops at the first solid sample it
 * meets, so a spray acts on what it touches and never through a wall. Round bodies a ray reaches
 * before terrain are collected; what happens to the sample and the bodies is the weapon's.
 */
export interface RayFanShape {
  /** Reach from the origin, world units. */
  length: number;
  /** Half-angle of the fan from the aim, degrees. */
  halfAngleDegrees: number;
  /** Rays across the fan (odd keeps one on the aim). */
  rays: number;
}

/** A round body standing on its feet point (`x`, `y` = bottom centre). */
export interface RayFanBody {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RayFanCast<Body extends RayFanBody> {
  field: SampleField;
  /** Bodies a ray can reach (leave the holder out). */
  bodies: readonly Body[];
  origin: Vec2;
  /** Aim direction (any length). */
  aim: Vec2;
  shape: RayFanShape;
}

export interface RayHit {
  end: Vec2;
  /** Sample the ray stopped at, if any. */
  sample: number | null;
}

export interface RayFanHits<Body extends RayFanBody> {
  origin: Vec2;
  /** Unit aim. */
  aim: Vec2;
  rays: RayHit[];
  /** Every body a ray reached before terrain. */
  bodies: Set<Body>;
}

const solidAt = (field: SampleField, p: Vec2): number | null => {
  const cx = Math.floor(p.x / field.cellSize);
  const cy = Math.floor(p.y / field.cellSize);
  if (cx < 0 || cy < 0 || cx >= field.widthCells || cy >= field.heightCells) return null;
  const index = cy * field.widthCells + cx;
  return (field.cells[index] ?? 0) === 0 ? null : index;
};

/** A body whose circle holds `p`. */
const bodyAt = <Body extends RayFanBody>(bodies: readonly Body[], p: Vec2): Body | undefined =>
  bodies.find(
    (body) => Math.hypot(p.x - body.x, p.y - (body.y - body.height / 2)) <= body.width / 2
  );

/** Directions of the fan's rays: evenly spread over ±half-angle of the aim. */
export function rayDirections(aim: Vec2, shape: RayFanShape): Vec2[] {
  const base = Math.atan2(aim.y, aim.x);
  const half = (shape.halfAngleDegrees * Math.PI) / 180;
  return Array.from({ length: shape.rays }, (_, i) => {
    const a = shape.rays === 1 ? base : base - half + (2 * half * i) / (shape.rays - 1);
    return { x: Math.cos(a), y: Math.sin(a) };
  });
}

/** Marches one ray: collects the bodies it passes and stops at the first terrain it meets. */
function castRay<Body extends RayFanBody>(
  cast: RayFanCast<Body>,
  dir: Vec2,
  reached: Set<Body>
): RayHit {
  const { origin, field } = cast;
  const { length } = cast.shape;
  const step = field.cellSize / 2;
  for (let s = step; s <= length; s += step) {
    const p = { x: origin.x + dir.x * s, y: origin.y + dir.y * s };
    const sample = solidAt(field, p);
    if (sample !== null) return { end: p, sample };
    const body = bodyAt(cast.bodies, p);
    if (body) reached.add(body);
  }
  return { end: { x: origin.x + dir.x * length, y: origin.y + dir.y * length }, sample: null };
}

/** Casts the fan for this step. */
export function castRayFan<Body extends RayFanBody>(cast: RayFanCast<Body>): RayFanHits<Body> {
  const aimLength = Math.hypot(cast.aim.x, cast.aim.y) || 1;
  const aim = { x: cast.aim.x / aimLength, y: cast.aim.y / aimLength };
  const bodies = new Set<Body>();
  const rays = rayDirections(aim, cast.shape).map((dir) => castRay(cast, dir, bodies));
  return { origin: cast.origin, aim, rays, bodies };
}

/** Pushes each reached body once along the aim: `accel` units / s² for `dt` seconds. */
export function pushAlongAim<Body extends RayFanBody & { vx: number; vy: number }>(
  hits: RayFanHits<Body>,
  push: { accel: number; dt: number }
): void {
  const dv = push.accel * push.dt;
  for (const body of hits.bodies) {
    body.vx += hits.aim.x * dv;
    body.vy += hits.aim.y * dv;
  }
}
