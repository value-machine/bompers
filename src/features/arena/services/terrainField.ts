import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { TerrainGrid } from "@/features/arena/types/arena.types";
import { sampleDistance } from "@/features/arena/services/terrainGrid";

/**
 * Terrain field queries for round bodies (slope-walking D2, D7): the signed distance field read
 * between samples, its outward normal, whether a circle overlaps terrain, and settling a circle
 * onto the ground below or above it. The field is the
 * same one the outline is drawn from (terrain-curves D8), so what a body rests on is what is drawn.
 * Exact within the field band (`FIELD_BAND_SAMPLES` samples); farther out it reads as the band.
 */

/** Signed distance at a world point (positive inside terrain), bilinear between sample centres. */
export function fieldDistanceAt(grid: TerrainGrid, p: Vec2): number {
  const u = p.x / grid.cellSize - 0.5;
  const v = p.y / grid.cellSize - 0.5;
  const cx = Math.floor(u);
  const cy = Math.floor(v);
  const fx = u - cx;
  const fy = v - cy;
  const top = sampleDistance(grid, cx, cy) * (1 - fx) + sampleDistance(grid, cx + 1, cy) * fx;
  const bottom =
    sampleDistance(grid, cx, cy + 1) * (1 - fx) + sampleDistance(grid, cx + 1, cy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

/** Unit normal pointing out of terrain at a world point (straight up where the field is flat). */
export function fieldNormalAt(grid: TerrainGrid, p: Vec2): Vec2 {
  const h = grid.cellSize / 2;
  const gx =
    fieldDistanceAt(grid, { x: p.x + h, y: p.y }) - fieldDistanceAt(grid, { x: p.x - h, y: p.y });
  const gy =
    fieldDistanceAt(grid, { x: p.x, y: p.y + h }) - fieldDistanceAt(grid, { x: p.x, y: p.y - h });
  const length = Math.hypot(gx, gy);
  if (length < 1e-9) return { x: 0, y: -1 };
  return { x: -gx / length, y: -gy / length };
}

/** A circle on the terrain field: its center and radius, world units. */
export interface FieldCircle {
  center: Vec2;
  radius: number;
}

/** A circle overlaps terrain when its center is closer to the surface than its radius. */
export function circleHitsSolid(grid: TerrainGrid, circle: FieldCircle): boolean {
  return fieldDistanceAt(grid, circle.center) > -circle.radius;
}

/** Where a vertical settle left the circle: resting at `centerY`, blocked above, or no ground. */
export type CircleSettle =
  | { kind: "ground"; centerY: number }
  | { kind: "blocked" }
  | { kind: "air" };

const SETTLE_HALVINGS = 14;

/** Offset in [free, hit] closest to contact on the free side (bisection; `free` is free). */
function contactOffset(
  probe: (dy: number) => boolean,
  span: { free: number; hit: number }
): number {
  let { free, hit } = span;
  for (let i = 0; i < SETTLE_HALVINGS; i += 1) {
    const mid = (free + hit) / 2;
    if (probe(mid)) hit = mid;
    else free = mid;
  }
  return free;
}

/**
 * Puts a circle onto the ground straight below or above it (slope-walking A3): lifts it out of
 * terrain by at most `rise`, or drops it onto ground at most `drop` below. Blocked when it is
 * still in terrain after the full lift; air when there is no ground within the drop.
 */
export function settleCircle(
  grid: TerrainGrid,
  circle: FieldCircle,
  reach: { rise: number; drop: number }
): CircleSettle {
  const probe = (dy: number): boolean =>
    circleHitsSolid(grid, {
      center: { x: circle.center.x, y: circle.center.y + dy },
      radius: circle.radius,
    });
  if (probe(0)) {
    if (probe(-reach.rise)) return { kind: "blocked" };
    return {
      kind: "ground",
      centerY: circle.center.y + contactOffset(probe, { free: -reach.rise, hit: 0 }),
    };
  }
  if (!probe(reach.drop)) return { kind: "air" };
  return {
    kind: "ground",
    centerY: circle.center.y + contactOffset(probe, { free: 0, hit: reach.drop }),
  };
}
