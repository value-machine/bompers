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

/** Which terrain a contour is of: all of it (the outline) or only breakable terrain (its fill). */
export interface ContourOptions {
  /** Widens the region by this many world units (the outline: the terrain grown by its width). */
  grow: number;
  breakableOnly: boolean;
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

/** Field value of a sample for this contour (+ grow); samples outside it read as far outside. */
function contourValue(pass: ContourPass, cx: number, cy: number): number {
  const { grid, grow } = pass;
  const index = sampleIndex(grid, cx, cy);
  if (index < 0) return -fieldBand(grid);
  const slot = grid.cells[index] ?? EMPTY_CELL;
  const excluded = pass.breakableOnly && slot !== EMPTY_CELL && !isBreakableSlot(grid.slots[slot]);
  if (excluded) return -fieldBand(grid);
  return (grid.distance[index] ?? -fieldBand(grid)) + grow;
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
function contourRow(shapes: MaskShapes, pass: ContourPass, cy: number): void {
  const size = pass.grid.cellSize;
  let from = -1;
  for (let cx = -1; cx <= pass.grid.widthCells; cx += 1) {
    const corners = cx < pass.grid.widthCells ? cellCorners(pass, cx, cy) : [];
    const cover = corners.length > 0 ? classifyCell(corners) : "none";
    if (cover === "full" && from < 0) from = cx;
    if (cover !== "full" && from >= 0) {
      const y = (cy + 0.5) * size;
      shapes.rects.push({ x: (from + 0.5) * size, y, w: (cx - from) * size, h: size });
      from = -1;
    }
    if (cover === "piece") shapes.pieces.push(cellPiece(corners));
  }
}

/**
 * The one terrain shape rule (terrain-curves D8): the region where the distance field (+ `grow`)
 * is positive, read from the current terrain only. With grow 0 over breakable terrain it clips
 * the breakable fills; grown by the outline width over all terrain it is the outline, drawn in
 * ink under the fills. Untouched slabs come out as their own drawn shape (the field is seeded
 * from it), crater rims and cut faces as true curves, and empty space as nothing.
 */
export function terrainContour(grid: TerrainGrid, options: ContourOptions): MaskShapes {
  const pass: ContourPass = { grid, ...options };
  const shapes: MaskShapes = { rects: [], pieces: [] };
  for (let cy = -1; cy < grid.heightCells; cy += 1) contourRow(shapes, pass, cy);
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
