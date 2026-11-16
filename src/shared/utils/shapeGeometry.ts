import type { Shape2D, Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * Point-in-shape tests shared by the level importer (point checks) and the terrain raster
 * (cell-centre sampling). Rules from the level file contract (LEVEL_FORMAT § 4): rects are
 * half-open, polygons use the non-zero fill rule.
 */
function polygonWinding(points: readonly Vec2[], p: Vec2): number {
  let winding = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[j]!;
    const b = points[i]!;
    const side = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
    if (a.y <= p.y && b.y > p.y && side > 0) winding += 1;
    else if (a.y > p.y && b.y <= p.y && side < 0) winding -= 1;
  }
  return winding;
}

/** True when `p` lies inside `shape` (non-zero rule for polygons). */
export function shapeContains(shape: Shape2D, p: Vec2): boolean {
  if (shape.type === "rect") {
    return p.x >= shape.x && p.x < shape.x + shape.w && p.y >= shape.y && p.y < shape.y + shape.h;
  }
  if (shape.type === "circle") {
    const dx = p.x - shape.cx;
    const dy = p.y - shape.cy;
    return dx * dx + dy * dy <= shape.r * shape.r;
  }
  return polygonWinding(shape.points, p) !== 0;
}

/** Distance from `p` to the segment a–b. */
function segmentDistance(a: Vec2, b: Vec2, p: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

function rectSignedDistance(rect: Extract<Shape2D, { type: "rect" }>, p: Vec2): number {
  const hx = rect.w / 2;
  const hy = rect.h / 2;
  const dx = Math.abs(p.x - (rect.x + hx)) - hx;
  const dy = Math.abs(p.y - (rect.y + hy)) - hy;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return -(outside + Math.min(Math.max(dx, dy), 0));
}

/**
 * Signed distance from `p` to the edge of `shape`, world units: positive inside, negative
 * outside, 0 on the edge (the terrain distance field, terrain-field D3). Polygons take the sign
 * from the non-zero rule, like `shapeContains`.
 */
export function shapeSignedDistance(shape: Shape2D, p: Vec2): number {
  if (shape.type === "rect") return rectSignedDistance(shape, p);
  if (shape.type === "circle") return shape.r - Math.hypot(p.x - shape.cx, p.y - shape.cy);
  const { points } = shape;
  let nearest = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    nearest = Math.min(nearest, segmentDistance(points[j]!, points[i]!, p));
  }
  return polygonWinding(points, p) !== 0 ? nearest : -nearest;
}

/** Flat [x, y, …] path of a star centred on 0,0 with its first point straight up. */
export function starPoints(points: number, outer: number, inner: number): number[] {
  const path: number[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    path.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return path;
}
