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
 * breakable pieces are plain slabs like stone (owner, terrain-curves D5). Also builds the masks
 * that clip breakable slabs to the terrain still standing.
 */
export interface SlabPiece {
  shape: TerrainShape;
  swatch: TerrainSwatch;
  surface: MaterialSurface;
}

/** Mockup numbers at the reference blob, scaled to the game (visual-pass D1). */
const SLAB = { radius: 14 * DESIGN_SCALE, lipInset: 6 * DESIGN_SCALE, lipTop: 4 * DESIGN_SCALE };
const LIP_HEIGHT = 9 * DESIGN_SCALE;
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

/** Ink pass: every slab stroked at twice the outline width under the fills (style E). */
export function drawSlabInk(g: Graphics, pieces: readonly SlabPiece[], width: number): void {
  g.clear();
  for (const { shape } of pieces) {
    // Stroke only: the fills cover the inside, so an ink fill would be pure overdraw.
    slabPath(g, shape).stroke({ width: width * 2, color: GAME_PALETTE.ink, join: "round" });
  }
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

/** World-space mask geometry: plain rects plus contour pieces (flat [x, y, …] polygons). */
export interface MaskShapes {
  rects: { x: number; y: number; w: number; h: number }[];
  pieces: number[][];
}

/** What one mask cell (between four sample centres) contributes. */
type CellCover = "none" | "fixed" | "field" | "piece";

interface MaskPass {
  grid: TerrainGrid;
  initial: Float32Array;
  grow: number;
}

const sampleIndex = (grid: TerrainGrid, cx: number, cy: number): number =>
  cx >= 0 && cy >= 0 && cx < grid.widthCells && cy < grid.heightCells
    ? cy * grid.widthCells + cx
    : -1;

/** Breakable-only field (+ grow): breakable or empty samples keep their distance, others are out. */
function maskValue(pass: MaskPass, cx: number, cy: number): number {
  const { grid, grow } = pass;
  const index = sampleIndex(grid, cx, cy);
  if (index < 0) return -fieldBand(grid);
  const slot = grid.cells[index] ?? EMPTY_CELL;
  if (slot !== EMPTY_CELL && !isBreakableSlot(grid.slots[slot])) return -fieldBand(grid);
  return (grid.distance[index] ?? -fieldBand(grid)) + grow;
}

const isBreakableSample = (grid: TerrainGrid, cx: number, cy: number): boolean => {
  const index = sampleIndex(grid, cx, cy);
  const slot = index < 0 ? EMPTY_CELL : (grid.cells[index] ?? EMPTY_CELL);
  return slot !== EMPTY_CELL && isBreakableSlot(grid.slots[slot]);
};

const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/**
 * Untouched mask cells (all four samples still at their load-time distance) are full squares,
 * so authored shapes keep their own sharp path (terrain-curves D2); touched cells follow the
 * field: full when all four values are positive, a contour piece when some are.
 */
function classifyCell(pass: MaskPass, cx: number, cy: number): CellCover {
  const { grid, initial } = pass;
  const corners = CORNERS.map(([dx, dy]) => ({ x: cx + dx, y: cy + dy }));
  const touched = corners.some(({ x, y }) => {
    const index = sampleIndex(grid, x, y);
    return index >= 0 && grid.distance[index] !== initial[index];
  });
  if (!touched) {
    return corners.some(({ x, y }) => isBreakableSample(grid, x, y)) ? "fixed" : "none";
  }
  const values = corners.map(({ x, y }) => maskValue(pass, x, y));
  if (values.every((v) => v > 0)) return "field";
  return values.some((v) => v > 0) ? "piece" : "none";
}

/**
 * The part of one mask cell where the field is positive: walk its corners clockwise, keep the
 * positive ones and add the linear zero crossing on every edge whose sign flips (marching
 * squares; exact distances make the crossings lie on the true rim, terrain-curves D1).
 */
function cellPiece(pass: MaskPass, cx: number, cy: number): number[] {
  const size = pass.grid.cellSize;
  const points = CORNERS.map(([dx, dy]) => ({
    x: (cx + dx + 0.5) * size,
    y: (cy + dy + 0.5) * size,
    v: maskValue(pass, cx + dx, cy + dy),
  }));
  const path: number[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!;
    if (a.v > 0) path.push(a.x, a.y);
    if (a.v > 0 !== b.v > 0) {
      const t = a.v / (a.v - b.v);
      path.push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
  });
  return path;
}

interface CellRun {
  cy: number;
  from: number;
  to: number;
  cover: CellCover;
}

/**
 * Appends a run of full cells in one row as one rect. Untouched ("fixed") runs are grown by the
 * ink width when asked; field runs already include it in their values.
 */
function pushRun(shapes: MaskShapes, pass: MaskPass, run: CellRun): void {
  const { cellSize: size } = pass.grid;
  const g = run.cover === "fixed" ? pass.grow : 0;
  shapes.rects.push({
    x: (run.from + 0.5) * size - g,
    y: (run.cy + 0.5) * size - g,
    w: (run.to - run.from) * size + g * 2,
    h: size + g * 2,
  });
}

/** One row of mask cells: runs of full cells as rects, partial cells as contour pieces. */
function maskRow(shapes: MaskShapes, pass: MaskPass, cy: number): void {
  const { widthCells } = pass.grid;
  let run: CellRun | null = null;
  for (let cx = -1; cx <= widthCells; cx += 1) {
    const cover = cx < widthCells ? classifyCell(pass, cx, cy) : "none";
    if (run && run.cover !== cover) {
      pushRun(shapes, pass, { ...run, to: cx });
      run = null;
    }
    if (!run && (cover === "fixed" || cover === "field")) run = { cy, from: cx, to: cx, cover };
    if (cover === "piece") shapes.pieces.push(cellPiece(pass, cx, cy));
  }
}

/**
 * Mask of the breakable terrain still standing, in world units: plain rects where no blast has
 * been (each cell spans four sample centres, so it reaches past an authored edge and the slab's
 * own path draws the corner) and contour pieces along every crater rim. `grow` widens it by that
 * many units (the ink mask: field + width, so the outer line survives next to standing terrain).
 */
export function breakableMask(grid: TerrainGrid, initial: Float32Array, grow: number): MaskShapes {
  const pass: MaskPass = { grid, initial, grow };
  const shapes: MaskShapes = { rects: [], pieces: [] };
  for (let cy = -1; cy < grid.heightCells; cy += 1) maskRow(shapes, pass, cy);
  return shapes;
}

/**
 * Draws the breakable masks: `cells` exactly (clips fills along crater rims), `ink` grown by the
 * ink width (clips the ink pass so the outer line survives next to standing terrain). Returns
 * false when no breakable terrain is left.
 */
export function drawBreakableMasks(
  grid: TerrainGrid,
  masks: { cells: Graphics; ink: Graphics },
  options: { initial: Float32Array; grow: number }
): boolean {
  masks.cells.clear();
  masks.ink.clear();
  const draw = (g: Graphics, shapes: MaskShapes): boolean => {
    for (const r of shapes.rects) g.rect(r.x, r.y, r.w, r.h);
    for (const piece of shapes.pieces) g.poly(piece);
    const any = shapes.rects.length > 0 || shapes.pieces.length > 0;
    if (any) g.fill(0xffffff);
    return any;
  };
  const any = draw(masks.cells, breakableMask(grid, options.initial, 0));
  draw(masks.ink, breakableMask(grid, options.initial, options.grow));
  return any;
}
