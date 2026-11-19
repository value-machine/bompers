import type { Graphics } from "pixi.js";
import { GAME_PALETTE, type TerrainSwatch } from "@/shared/config/gamePalette";
import { shapeContains } from "@/shared/utils/shapeGeometry";
import { DESIGN_SCALE } from "@/shared/utils/outlineWidth";
import type { MaterialSurface } from "@/shared/types/terrainSurface.types";
import type { TerrainShape } from "@/features/level/api/levelApi";
import { EMPTY_CELL, type TerrainGrid } from "@/features/arena/types/arena.types";
import { fieldBand, isBreakableSlot } from "@/features/arena/services/terrainGrid";

/**
 * Terrain slab drawing shared by every material (DESIGN_LANGUAGE § 2): one rounded slab with a
 * lighter lip on top, in the piece's colour swatch. Ice gets gloss streaks and a white inner rim;
 * breakable pieces are plain slabs like stone (owner, terrain-curves D5). The outline and the
 * clip of breakable fills both come from one rule: the contour of the terrain distance field
 * (terrain-curves D8).
 */
export interface SlabPiece {
  shape: TerrainShape;
  swatch: TerrainSwatch;
  surface: MaterialSurface;
}

/** Mockup numbers at the reference blob, scaled to the game (visual-pass D1). */
const SLAB = { radius: 14 * DESIGN_SCALE, lipInset: 6 * DESIGN_SCALE, lipTop: 4 * DESIGN_SCALE };
const LIP_HEIGHT = 9 * DESIGN_SCALE;

/** Rect slabs' corner radius; the terrain field is seeded with it so its contour is the slab. */
export const SLAB_CORNER_RADIUS = SLAB.radius;
/** Ice cue: inner rim and two diagonal gloss streaks near the top-left of the piece. */
const ICE = { rim: 1.6, rimAlpha: 0.75, streak: 2.2, streakAlpha: 0.6 };
const STREAKS = [
  { fx: 0.12, fy: 0.3, len: 0.5 },
  { fx: 0.2, fy: 0.3, len: 0.3 },
] as const;

export function slabPath(g: Graphics, shape: TerrainShape): Graphics {
  if (shape.type === "rect") {
    const radius = Math.min(SLAB.radius, shape.w / 2, shape.h / 2);
    return g.roundRect(shape.x, shape.y, shape.w, shape.h, radius);
  }
  if (shape.type === "circle") return g.circle(shape.cx, shape.cy, shape.r);
  return g.poly(shape.points.flatMap((p) => [p.x, p.y]));
}

function shapeBox(shape: TerrainShape) {
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

/** Gloss streaks: short 45° strokes, kept only where both ends lie inside the shape. */
function drawIceGloss(g: Graphics, shape: TerrainShape): void {
  const box = shapeBox(shape);
  const size = Math.min(box.w, box.h, 60);
  for (const s of STREAKS) {
    const from = { x: box.x + box.w * s.fx, y: box.y + size * s.fy + size * s.len * 0.5 };
    const to = { x: from.x + size * s.len * 0.5, y: from.y - size * s.len * 0.5 };
    if (!shapeContains(shape, from) || !shapeContains(shape, to)) continue;
    g.moveTo(from.x, from.y).lineTo(to.x, to.y);
  }
  g.stroke({
    width: ICE.streak,
    color: GAME_PALETTE.iceGloss,
    alpha: ICE.streakAlpha,
    cap: "round",
  });
  slabPath(g, shape).stroke({
    width: ICE.rim,
    color: GAME_PALETTE.iceGloss,
    alpha: ICE.rimAlpha,
    alignment: 1,
  });
}

/** Fills, then the lip along the top of rect slabs tall enough to carry one, then ice cues. */
export function drawSlabFill(g: Graphics, pieces: readonly SlabPiece[]): void {
  g.clear();
  for (const { shape, swatch } of pieces) slabPath(g, shape).fill(swatch.fill);
  for (const { shape, swatch } of pieces) {
    if (shape.type !== "rect" || shape.h < LIP_HEIGHT * 2) continue;
    g.roundRect(
      shape.x + SLAB.lipInset,
      shape.y + SLAB.lipTop,
      shape.w - SLAB.lipInset * 2,
      LIP_HEIGHT,
      LIP_HEIGHT / 2
    ).fill(swatch.lip);
  }
  for (const { shape, surface } of pieces) if (surface === "ice") drawIceGloss(g, shape);
}

/** World-space contour geometry: plain rects plus contour pieces (flat [x, y, …] polygons). */
export interface MaskShapes {
  rects: { x: number; y: number; w: number; h: number }[];
  pieces: number[][];
}

/**
 * A part of the terrain as a field over its samples: breakable terrain, burning terrain, frozen
 * ground. A contour limited to a region is the terrain's own shape wherever the region reaches
 * the terrain's edge, and the region's edge inside the terrain (element-overlay-shape D1).
 */
export interface SampleRegion {
  /** Field value of a sample (row-major index), world units: positive inside the region. */
  value: (index: number) => number;
  /** Samples the region lies within; the contour marches only these (default: the whole grid). */
  box?: SampleBox;
}

/** An inclusive range of samples. */
export interface SampleBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Which terrain a contour is of: all of it, or the part inside a region. */
export interface ContourOptions {
  /** Widens the shape by this many world units (the outline: the terrain grown by its width). */
  grow: number;
  region?: SampleRegion;
}

/** What one contour cell (between four sample centres) contributes. */
type CellCover = "none" | "full" | "piece";

interface ContourPass extends ContourOptions {
  grid: TerrainGrid;
}

const sampleIndex = (grid: TerrainGrid, cx: number, cy: number): number =>
  cx >= 0 && cy >= 0 && cx < grid.widthCells && cy < grid.heightCells
    ? cy * grid.widthCells + cx
    : -1;

const isSolidSample = (grid: TerrainGrid, index: number): boolean =>
  (grid.cells[index] ?? EMPTY_CELL) !== EMPTY_CELL;

/** The breakable terrain as a region: every sample but the unbreakable solid ones. */
export function breakableRegion(grid: TerrainGrid): SampleRegion {
  const band = fieldBand(grid);
  return {
    value: (index) =>
      isSolidSample(grid, index) && !isBreakableSlot(grid.slots[grid.cells[index]!]) ? -band : band,
  };
}

/**
 * How far inside its edge a marked sample with only marked neighbours reads, in samples. More
 * than a sample's diagonal, so the terrain's own distance wins along the terrain's edge.
 */
const MARKED_DEPTH_SAMPLES = 1.5;

/** Share of the solid samples around a sample (itself included) that are marked. */
function markedShare(grid: TerrainGrid, isMarked: (index: number) => boolean, index: number) {
  const cx = index % grid.widthCells;
  const cy = Math.floor(index / grid.widthCells);
  let solid = 0;
  let hits = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const near = sampleIndex(grid, cx + dx, cy + dy);
      if (near < 0 || !isSolidSample(grid, near)) continue;
      solid += 1;
      if (isMarked(near)) hits += 1;
    }
  }
  return solid > 0 ? hits / solid : 0;
}

/** The solid ones among `samples` and the box that holds them (null when there are none). */
function solidSamples(grid: TerrainGrid, samples: Iterable<number>) {
  const solid: number[] = [];
  const box: SampleBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const index of samples) {
    if (!isSolidSample(grid, index)) continue;
    solid.push(index);
    const cx = index % grid.widthCells;
    const cy = Math.floor(index / grid.widthCells);
    box.minX = Math.min(box.minX, cx);
    box.maxX = Math.max(box.maxX, cx);
    box.minY = Math.min(box.minY, cy);
    box.maxY = Math.max(box.maxY, cy);
  }
  return solid.length > 0 ? { solid, box } : null;
}

/**
 * The region of a set of marked solid samples (the burning ones, the frozen ones, the stained
 * ones). A marked sample is always inside and an unmarked solid one never is; how far depends on
 * the share of its solid neighbours that are marked, so the region's edge inside the terrain is
 * a curve between the samples instead of their steps. Empty samples do not limit it: there the
 * terrain's own edge is the edge. Null when nothing solid is marked. Its working memory is the
 * size of the marked samples' box, not of the grid, so a small part costs little to rebuild.
 */
export function markedRegion(grid: TerrainGrid, samples: Iterable<number>): SampleRegion | null {
  const found = solidSamples(grid, samples);
  if (!found) return null;
  // One sample of margin: the unmarked samples next to the part get a value from their neighbours.
  const x0 = found.box.minX - 1;
  const y0 = found.box.minY - 1;
  const width = found.box.maxX - x0 + 2;
  const height = found.box.maxY - y0 + 2;
  const local = (index: number): number => {
    const cx = (index % grid.widthCells) - x0;
    const cy = Math.floor(index / grid.widthCells) - y0;
    return cx < 0 || cy < 0 || cx >= width || cy >= height ? -1 : cy * width + cx;
  };
  const marked = new Uint8Array(width * height);
  for (const index of found.solid) marked[local(index)] = 1;
  const isMarked = (index: number): boolean => marked[local(index)] === 1;
  const band = fieldBand(grid);
  const depth = MARKED_DEPTH_SAMPLES * grid.cellSize * 2;
  const known = new Float32Array(width * height).fill(Number.NaN);
  const value = (index: number): number => {
    if (!isSolidSample(grid, index)) return band;
    const at = local(index);
    if (at < 0) return -depth / 2;
    const seen = known[at]!;
    if (!Number.isNaN(seen)) return seen;
    const fresh = (((marked[at] ?? 0) + markedShare(grid, isMarked, index)) / 2 - 0.5) * depth;
    known[at] = fresh;
    return fresh;
  };
  return { value, box: found.box };
}

/**
 * World y of the terrain's edge right above a solid sample: where the distance crosses zero
 * between it and the empty sample over it (the same crossing the contour draws). Null when the
 * sample is empty or has terrain above it.
 */
export function edgeAbove(grid: TerrainGrid, index: number): number | null {
  if (!isSolidSample(grid, index)) return null;
  const above = index - grid.widthCells;
  const own = grid.distance[index] ?? 0;
  const over = above >= 0 ? (grid.distance[above] ?? -fieldBand(grid)) : -fieldBand(grid);
  if (over > 0 || own <= 0) return null;
  const row = Math.floor(index / grid.widthCells);
  return (row + 0.5 - own / (own - over)) * grid.cellSize;
}

/** Field value of a sample for this contour (+ grow); samples outside it read as far outside. */
function contourValue(pass: ContourPass, cx: number, cy: number): number {
  const { grid, grow, region } = pass;
  const index = sampleIndex(grid, cx, cy);
  if (index < 0) return -fieldBand(grid);
  const own = grid.distance[index] ?? -fieldBand(grid);
  return (region ? Math.min(own, region.value(index)) : own) + grow;
}

const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/** The four corner samples of a contour cell with their world positions and values. */
function cellCorners(pass: ContourPass, cx: number, cy: number) {
  const size = pass.grid.cellSize;
  return CORNERS.map(([dx, dy]) => ({
    x: (cx + dx + 0.5) * size,
    y: (cy + dy + 0.5) * size,
    v: contourValue(pass, cx + dx, cy + dy),
  }));
}

function classifyCell(corners: readonly { v: number }[]): CellCover {
  if (corners.every((c) => c.v > 0)) return "full";
  return corners.some((c) => c.v > 0) ? "piece" : "none";
}

/**
 * The part of one contour cell where the field is positive: walk its corners clockwise, keep the
 * positive ones and add the linear zero crossing on every edge whose sign flips (marching
 * squares; the field's distances make the crossings lie on the true edge, terrain-curves D1).
 */
function cellPiece(corners: readonly { x: number; y: number; v: number }[]): number[] {
  const path: number[] = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length]!;
    if (a.v > 0) path.push(a.x, a.y);
    if (a.v > 0 !== b.v > 0) {
      const t = a.v / (a.v - b.v);
      path.push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
  });
  return path;
}

/** One row of contour cells: runs of full cells as rects, partial cells as pieces. */
function contourRow(shapes: MaskShapes, pass: ContourPass, row: { cy: number; box: SampleBox }) {
  const size = pass.grid.cellSize;
  const { cy, box } = row;
  let from: number | null = null;
  for (let cx = box.minX; cx <= box.maxX + 1; cx += 1) {
    const corners = cx <= box.maxX ? cellCorners(pass, cx, cy) : [];
    const cover = corners.length > 0 ? classifyCell(corners) : "none";
    if (cover === "full" && from === null) from = cx;
    if (cover !== "full" && from !== null) {
      const y = (cy + 0.5) * size;
      shapes.rects.push({ x: (from + 0.5) * size, y, w: (cx - from) * size, h: size });
      from = null;
    }
    if (cover === "piece") shapes.pieces.push(cellPiece(corners));
  }
}

/** Contour cells to march: every cell that touches the region's samples, grown shape included. */
function contourCells(grid: TerrainGrid, options: ContourOptions): SampleBox {
  const all = { minX: -1, minY: -1, maxX: grid.widthCells - 1, maxY: grid.heightCells - 1 };
  const box = options.region?.box;
  if (!box) return all;
  const pad = 1 + Math.ceil(Math.max(0, options.grow) / grid.cellSize);
  return {
    minX: Math.max(all.minX, box.minX - pad),
    minY: Math.max(all.minY, box.minY - pad),
    maxX: Math.min(all.maxX, box.maxX + pad - 1),
    maxY: Math.min(all.maxY, box.maxY + pad - 1),
  };
}

/**
 * The one terrain shape rule (terrain-curves D8): the shape where the distance field (+ `grow`)
 * is positive, read from the current terrain only. Grown by the outline width over all terrain
 * it is the outline, drawn in ink under the fills. Limited to a `region` it is that part of the
 * terrain in the terrain's own shape: breakable terrain (the clip of the breakable fills),
 * burning terrain, frozen ground. Untouched slabs come out as their own drawn shape (the field
 * is seeded from it), crater rims and cut faces as true curves, and empty space as nothing.
 */
export function terrainContour(grid: TerrainGrid, options: ContourOptions): MaskShapes {
  const pass: ContourPass = { grid, ...options };
  const shapes: MaskShapes = { rects: [], pieces: [] };
  const box = contourCells(grid, options);
  for (let cy = box.minY; cy <= box.maxY; cy += 1) contourRow(shapes, pass, { cy, box });
  return shapes;
}

/** Fills a graphics object with contour shapes; returns false when there are none. */
export function drawContour(g: Graphics, shapes: MaskShapes, color: number): boolean {
  g.clear();
  for (const r of shapes.rects) g.rect(r.x, r.y, r.w, r.h);
  for (const piece of shapes.pieces) g.poly(piece);
  const any = shapes.rects.length > 0 || shapes.pieces.length > 0;
  if (any) g.fill(color);
  return any;
}

/**
 * One closed line along an edge of the terrain shape (outline-system D1): flat [x, y, …] points
 * with the terrain always on the same side, so a hole winds against the slab it is in. `closed`
 * is false only where a region's box cuts the line off.
 */
export interface OutlineRing {
  points: number[];
  closed: boolean;
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
const crossing = (
  inside: { x: number; y: number; v: number },
  outside: { x: number; y: number; v: number }
): { x: number; y: number } => {
  const t = inside.v / (inside.v - outside.v);
  return { x: inside.x + (outside.x - inside.x) * t, y: inside.y + (outside.y - inside.y) * t };
};

/**
 * The id of the grid edge side `side` of contour cell (cx, cy) lies on (0 top, 1 right, 2 bottom,
 * 3 left). Two cells that share an edge give it the same id, so their pieces of the line join by
 * id, not by comparing coordinates.
 */
function edgeId(grid: TerrainGrid, cell: { cx: number; cy: number }, side: number): number {
  const sx = cell.cx + (side === 1 ? 1 : 0);
  const sy = cell.cy + (side === 2 ? 1 : 0);
  const vertical = side === 1 || side === 3;
  return ((sy + 1) * (grid.widthCells + 2) + sx + 1) * 2 + (vertical ? 1 : 0);
}

/**
 * The edge pieces of one contour cell: walking its corners clockwise, each piece runs from where
 * the walk leaves the shape to where it enters it again (the same crossings `cellPiece` adds).
 */
function cellSegments(
  segments: Map<number, RingSegment>,
  pass: ContourPass,
  cell: { cx: number; cy: number }
): void {
  const corners = cellCorners(pass, cell.cx, cell.cy);
  if (classifyCell(corners) !== "piece") return;
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
    segments.set(edgeId(pass.grid, cell, side), {
      to: edgeId(pass.grid, cell, back),
      x: from.x,
      y: from.y,
      endX: to.x,
      endY: to.y,
    });
  }
}

/** Points closer together than this are one point: a stroke needs no zero-length segment. */
const RING_MIN_STEP = 0.05;

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
 * The outline builder (outline-system D1): the edge of the one terrain shape (`terrainContour`'s
 * shape, same options) as closed rings, for drawing an outline as a line. The rings are the
 * exact boundary of the contour's rects and pieces. An open line is first followed from its
 * free start, so it comes out whole.
 */
export function terrainRings(grid: TerrainGrid, options: ContourOptions): OutlineRing[] {
  const pass: ContourPass = { grid, ...options };
  const box = contourCells(grid, options);
  const segments = new Map<number, RingSegment>();
  for (let cy = box.minY; cy <= box.maxY; cy += 1) {
    for (let cx = box.minX; cx <= box.maxX; cx += 1) cellSegments(segments, pass, { cx, cy });
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

/**
 * Draws rings as an ink line (outline-system D1): stroked at twice the visible width with round
 * joins, to sit under the shape's fill, which hides the inner half. Returns false when there are
 * no rings.
 */
export function drawOutline(
  g: Graphics,
  rings: readonly OutlineRing[],
  line: { width: number; color: number }
): boolean {
  g.clear();
  for (const ring of rings) g.poly(ring.points, ring.closed);
  if (rings.length > 0) {
    g.stroke({ width: line.width * 2, color: line.color, join: "round", cap: "round" });
  }
  return rings.length > 0;
}
