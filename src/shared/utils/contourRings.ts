/**
 * Contour rings (outline-system D1; extracted for the freeze ray's cloud shape, freeze-ray-shape
 * D2): the edge of a scalar field's positive region as lines, by marching squares. Each cell's
 * corners come from the caller, so the terrain's distance field and a spray's puff field share
 * one tracer. Positive is inside. The rings are the exact boundary of the cells' positive pieces:
 * a crossing lies where the field is zero by linear interpolation along the cell edge.
 */
export interface OutlineRing {
  points: number[];
  closed: boolean;
}

/** One corner of a contour cell: its world position and field value (positive is inside). */
export interface ContourCorner {
  x: number;
  y: number;
  v: number;
}

/**
 * The cells to trace, from (minX, minY) to (maxX, maxY) inclusive, and the four corners of each,
 * clockwise from its top-left: top-left, top-right, bottom-right, bottom-left. The tracer reads
 * them only while it handles that cell, so the caller may reuse one array.
 */
export interface ContourCells {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  corners: (cx: number, cy: number) => readonly ContourCorner[];
}

/** One edge piece inside a contour cell: from the grid edge it starts on to the one it ends on. */
interface RingSegment {
  to: number;
  x: number;
  y: number;
  endX: number;
  endY: number;
}

/** Where the field crosses zero between a positive and a non-positive corner, from the positive one. */
const crossing = (inside: ContourCorner, outside: ContourCorner): { x: number; y: number } => {
  const t = inside.v / (inside.v - outside.v);
  return { x: inside.x + (outside.x - inside.x) * t, y: inside.y + (outside.y - inside.y) * t };
};

/**
 * The id of the grid edge side `side` of cell (cx, cy) lies on (0 top, 1 right, 2 bottom,
 * 3 left). Two cells that share an edge give it the same id, so their pieces of the line join by
 * id, not by comparing coordinates.
 */
function edgeId(cells: ContourCells, cell: { cx: number; cy: number }, side: number): number {
  const stride = cells.maxX - cells.minX + 3;
  const sx = cell.cx - cells.minX + (side === 1 ? 1 : 0);
  const sy = cell.cy - cells.minY + (side === 2 ? 1 : 0);
  const vertical = side === 1 || side === 3;
  return ((sy + 1) * stride + sx + 1) * 2 + (vertical ? 1 : 0);
}

/**
 * The edge pieces of one cell: walking its corners clockwise, each piece runs from where the walk
 * leaves the shape to where it enters it again.
 */
function cellSegments(
  segments: Map<number, RingSegment>,
  cells: ContourCells,
  cell: { cx: number; cy: number }
): void {
  const corners = cells.corners(cell.cx, cell.cy);
  let inside = 0;
  for (const c of corners) if (c.v > 0) inside += 1;
  if (inside === 0 || inside === corners.length) return;
  const count = corners.length;
  for (let side = 0; side < count; side += 1) {
    const a = corners[side]!;
    const b = corners[(side + 1) % count]!;
    if (!(a.v > 0) || b.v > 0) continue;
    // Leaves the shape on this side; it comes back in on the next side whose sign flips.
    let back = (side + 1) % count;
    while (!(corners[(back + 1) % count]!.v > 0)) back = (back + 1) % count;
    const from = crossing(a, b);
    const to = crossing(corners[(back + 1) % count]!, corners[back]!);
    segments.set(edgeId(cells, cell, side), {
      to: edgeId(cells, cell, back),
      x: from.x,
      y: from.y,
      endX: to.x,
      endY: to.y,
    });
  }
}

/** Points closer together than this are one point: a stroke needs no zero-length segment. */
export const RING_MIN_STEP = 0.05;

/** The points without the ones that repeat the point before them (the first, for a closed line). */
function distinctPoints(points: readonly number[], closed: boolean): number[] {
  const kept: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const n = kept.length;
    const near =
      n >= 2 &&
      Math.hypot(points[i]! - kept[n - 2]!, points[i + 1]! - kept[n - 1]!) < RING_MIN_STEP;
    if (!near) kept.push(points[i]!, points[i + 1]!);
  }
  const n = kept.length;
  const wraps =
    closed &&
    n >= 4 &&
    Math.hypot(kept[0]! - kept[n - 2]!, kept[1]! - kept[n - 1]!) < RING_MIN_STEP;
  if (wraps) kept.length = n - 2;
  return kept;
}

/** True when point `i` lies on the straight run between its two neighbours. */
function isStraightPoint(points: readonly number[], i: number, closed: boolean): boolean {
  const n = points.length / 2;
  if (!closed && (i === 0 || i === n - 1)) return false;
  const p = ((i - 1 + n) % n) * 2;
  const q = ((i + 1) % n) * 2;
  const ax = points[i * 2]! - points[p]!;
  const ay = points[i * 2 + 1]! - points[p + 1]!;
  const bx = points[q]! - points[i * 2]!;
  const by = points[q + 1]! - points[i * 2 + 1]!;
  const bend = Math.abs(ax * by - ay * bx);
  return bend < 1e-6 * (Math.hypot(ax, ay) + Math.hypot(bx, by)) && ax * bx + ay * by > 0;
}

/** Drops repeated points and the points inside a straight run, so a flat edge is one segment. */
function tidyRing(points: readonly number[], closed: boolean): number[] {
  const kept = distinctPoints(points, closed);
  const out: number[] = [];
  for (let i = 0; i < kept.length / 2; i += 1) {
    if (!isStraightPoint(kept, i, closed)) out.push(kept[i * 2]!, kept[i * 2 + 1]!);
  }
  return out;
}

/** Follows the pieces from one start until the line closes or runs out; removes them as it goes. */
function chainRing(segments: Map<number, RingSegment>, start: number): OutlineRing {
  const points: number[] = [];
  let key = start;
  let closed = false;
  for (;;) {
    const segment = segments.get(key);
    if (!segment) break;
    segments.delete(key);
    points.push(segment.x, segment.y);
    if (segment.to === start) {
      closed = true;
      break;
    }
    if (!segments.has(segment.to)) points.push(segment.endX, segment.endY);
    key = segment.to;
  }
  return { points: tidyRing(points, closed), closed };
}

/**
 * The edge of the field's positive region as rings. A line that runs out of the traced cells is
 * open; it is followed from its free start, so it comes out whole.
 */
export function traceRings(cells: ContourCells): OutlineRing[] {
  const segments = new Map<number, RingSegment>();
  for (let cy = cells.minY; cy <= cells.maxY; cy += 1) {
    for (let cx = cells.minX; cx <= cells.maxX; cx += 1) cellSegments(segments, cells, { cx, cy });
  }
  const ends = new Set<number>();
  for (const segment of segments.values()) ends.add(segment.to);
  const rings: OutlineRing[] = [];
  const take = (start: number): void => {
    const ring = chainRing(segments, start);
    if (ring.points.length >= (ring.closed ? 6 : 4)) rings.push(ring);
  };
  for (const start of [...segments.keys()]) if (!ends.has(start)) take(start);
  for (const start of [...segments.keys()]) if (segments.has(start)) take(start);
  return rings;
}
