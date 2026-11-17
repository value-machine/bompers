import type { Rect, Shape2D, Vec2 } from "@/shared/types/gameGeometry.types";

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

/** Rounded-box distance (corner radius clamped to half the shorter side), positive inside. */
function rectSignedDistance(
  rect: Extract<Shape2D, { type: "rect" }>,
  p: Vec2,
  cornerRadius: number
): number {
  const hx = rect.w / 2;
  const hy = rect.h / 2;
  const r = Math.max(0, Math.min(cornerRadius, hx, hy));
  const dx = Math.abs(p.x - (rect.x + hx)) - (hx - r);
  const dy = Math.abs(p.y - (rect.y + hy)) - (hy - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return -(outside + Math.min(Math.max(dx, dy), 0) - r);
}

/**
 * Signed distance from `p` to the edge of `shape`, world units: positive inside, negative
 * outside, 0 on the edge (the terrain distance field, terrain-field D3). Polygons take the sign
 * from the non-zero rule, like `shapeContains`. `cornerRadius` rounds rect corners (the terrain
 * slab is drawn that way, so its distance field matches the drawn shape; terrain-curves D8).
 */
export function shapeSignedDistance(shape: Shape2D, p: Vec2, cornerRadius = 0): number {
  if (shape.type === "rect") return rectSignedDistance(shape, p, cornerRadius);
  if (shape.type === "circle") return shape.r - Math.hypot(p.x - shape.cx, p.y - shape.cy);
  const { points } = shape;
  let nearest = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    nearest = Math.min(nearest, segmentDistance(points[j]!, points[i]!, p));
  }
  return polygonWinding(points, p) !== 0 ? nearest : -nearest;
}

/** Axis-aligned bounding box of a shape. */
export function shapeBounds(shape: Shape2D): Rect {
  if (shape.type === "rect") return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
  if (shape.type === "circle") {
    return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 };
  }
  const xs = shape.points.map((p) => p.x);
  const ys = shape.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Points along a polyline loop, at most `step` apart, corners included. */
function loopOutline(corners: readonly Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < corners.length; i += 1) {
    const a = corners[i]!;
    const b = corners[(i + 1) % corners.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k += 1) {
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
  }
  return out;
}

/** Points on the shape's edge, at most `step` world units apart (sweep and overlap checks). */
export function shapeOutlinePoints(shape: Shape2D, step: number): Vec2[] {
  if (shape.type === "polygon") return loopOutline(shape.points, step);
  if (shape.type === "rect") {
    const { x, y, w, h } = shape;
    const corners = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
    return loopOutline(corners, step);
  }
  const n = Math.max(8, Math.ceil((Math.PI * 2 * shape.r) / step));
  return Array.from({ length: n }, (_, k) => ({
    x: shape.cx + shape.r * Math.cos((Math.PI * 2 * k) / n),
    y: shape.cy + shape.r * Math.sin((Math.PI * 2 * k) / n),
  }));
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
