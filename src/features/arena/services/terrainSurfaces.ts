import type { Graphics } from "pixi.js";
import { GAME_PALETTE, type TerrainSwatch } from "@/shared/config/gamePalette";
import { shapeContains } from "@/shared/utils/shapeGeometry";
import { DESIGN_SCALE } from "@/shared/utils/outlineWidth";
import type { MaterialSurface } from "@/shared/types/terrainSurface.types";
import type { TerrainShape } from "@/features/level/api/levelApi";
import type { TerrainGrid } from "@/features/arena/types/arena.types";

/**
 * Terrain slab drawing shared by every material (DESIGN_LANGUAGE § 2): one rounded slab with a
 * lighter lip on top, in the piece's colour swatch. The surface pattern is the behaviour cue that
 * never depends on colour: ice gets gloss streaks and a white inner rim; breakable pieces get a
 * seam grid (drawn per tile by the renderer). Also builds the cell masks that clip breakable slabs
 * to the cells still standing.
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

const isBreakableCell = (grid: TerrainGrid, cx: number, cy: number): boolean => {
  const slot = grid.cells[cy * grid.widthCells + cx] ?? 0;
  return slot !== 0 && grid.slots[slot]?.destructible === true;
};

/** Horizontal runs `[from, to)` of breakable cells in one row. */
function breakableRuns(grid: TerrainGrid, cy: number): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = [];
  let from = -1;
  for (let cx = 0; cx < grid.widthCells; cx += 1) {
    const on = isBreakableCell(grid, cx, cy);
    if (on && from < 0) from = cx;
    if (!on && from >= 0) {
      runs.push({ from, to: cx });
      from = -1;
    }
  }
  if (from >= 0) runs.push({ from, to: grid.widthCells });
  return runs;
}

/**
 * Masks of the breakable cells still standing: `cells` exactly (clips fills), `ink` grown by
 * `grow` world units (clips the ink pass so the outer line survives next to standing cells).
 * One rect per horizontal run of breakable cells. Empty when none are left.
 */
export function drawBreakableMasks(
  grid: TerrainGrid,
  masks: { cells: Graphics; ink: Graphics },
  grow: number
): boolean {
  masks.cells.clear();
  masks.ink.clear();
  const size = grid.cellSize;
  let any = false;
  for (let cy = 0; cy < grid.heightCells; cy += 1) {
    for (const run of breakableRuns(grid, cy)) {
      const x = run.from * size;
      const w = (run.to - run.from) * size;
      masks.cells.rect(x, cy * size, w, size);
      masks.ink.rect(x - grow, cy * size - grow, w + grow * 2, size + grow * 2);
      any = true;
    }
  }
  if (any) {
    masks.cells.fill(0xffffff);
    masks.ink.fill(0xffffff);
  }
  return any;
}
