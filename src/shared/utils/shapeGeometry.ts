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
