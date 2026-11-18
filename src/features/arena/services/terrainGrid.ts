import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import type { CraterShape } from "@/shared/types/craterShape.types";
import type { MotionPose } from "@/shared/types/levelMotion.types";
import { craterShapeDistance } from "@/shared/utils/craterShape";
import { unposePoint } from "@/shared/utils/levelMotion";
import {
  EMPTY_CELL,
  type MoverBody,
  type TerrainCellSlot,
  type TerrainGrid,
} from "@/features/arena/types/arena.types";

/**
 * Terrain cell grid: collision queries and destruction. Pure TS; mutates the grid it is given.
 * Out-of-range cells read as empty, so open map edges need no special case.
 */
export const DEFAULT_CHUNK_CELLS = 16;

export interface TerrainGridSize {
  cellSize: number;
  widthCells: number;
  heightCells: number;
  chunkCells?: number;
}

const EMPTY_SLOT: TerrainCellSlot = {
  materialId: "",
  colorId: "",
  toughness: null,
  friction: 1,
  surface: "plain",
  burns: false,
  douses: false,
};

/** True for a slot a blast can clear (it has a toughness); false for empty or unbreakable. */
export const isBreakableSlot = (info: TerrainCellSlot | null | undefined): boolean =>
  info !== null && info !== undefined && info.toughness !== null;

/**
 * Distances are clamped to this many samples either side of an edge (terrain-field D2). Five, so
 * the field and its normal stay exact one body radius (14 units) off the surface (slope-walking A5).
 */
export const FIELD_BAND_SAMPLES = 5;

/**
 * Half a sample's diagonal, in samples: an edge between a solid and an empty sample centre lies
 * at least this much less far than the empty centre (the bound used where no shape gives the
 * exact distance).
 */
export const HALF_DIAGONAL = Math.SQRT1_2;

/** Smallest positive distance a solid sample keeps, world units. */
export const EDGE_EPSILON = 0.01;

/** The distance clamp of a grid, world units. */
export const fieldBand = (grid: TerrainGrid): number => FIELD_BAND_SAMPLES * grid.cellSize;

export function createTerrainGrid(size: TerrainGridSize): TerrainGrid {
  const chunkCells = size.chunkCells ?? DEFAULT_CHUNK_CELLS;
  const chunksX = Math.ceil(size.widthCells / chunkCells);
  const chunksY = Math.ceil(size.heightCells / chunkCells);
  const dirtyChunks = new Set<number>();
  for (let i = 0; i < chunksX * chunksY; i += 1) dirtyChunks.add(i);
  const count = size.widthCells * size.heightCells;
  return {
    cellSize: size.cellSize,
    widthCells: size.widthCells,
    heightCells: size.heightCells,
    cells: new Uint8Array(count),
    distance: new Float32Array(count).fill(-FIELD_BAND_SAMPLES * size.cellSize),
    anchored: new Uint8Array(count),
    slots: [EMPTY_SLOT],
    chunkCells,
    chunksX,
    chunksY,
    dirtyChunks,
    movers: [],
  };
}

/** Index of the slot for this material + colour, added on first use. */
export function slotFor(grid: TerrainGrid, slot: TerrainCellSlot): number {
  const found = grid.slots.findIndex(
    (s, i) => i > 0 && s.materialId === slot.materialId && s.colorId === slot.colorId
  );
  if (found > 0) return found;
  grid.slots.push(slot);
  return grid.slots.length - 1;
}

const inGrid = (grid: TerrainGrid, cx: number, cy: number): boolean =>
  cx >= 0 && cy >= 0 && cx < grid.widthCells && cy < grid.heightCells;

const chunkIndexOfCell = (grid: TerrainGrid, cx: number, cy: number): number =>
  Math.floor(cy / grid.chunkCells) * grid.chunksX + Math.floor(cx / grid.chunkCells);

/** Slot index of a cell (0 = empty, also outside the grid). */
export function getCellSlot(grid: TerrainGrid, cx: number, cy: number): number {
  if (!inGrid(grid, cx, cy)) return EMPTY_CELL;
  return grid.cells[cy * grid.widthCells + cx] ?? EMPTY_CELL;
}

/** Material info of a cell, or null when empty. */
export function getCellInfo(grid: TerrainGrid, cx: number, cy: number): TerrainCellSlot | null {
  const slot = getCellSlot(grid, cx, cy);
  return slot === EMPTY_CELL ? null : (grid.slots[slot] ?? null);
}

/** Signed distance at a sample centre (outside the grid: the band's negative edge, i.e. air). */
export function sampleDistance(grid: TerrainGrid, cx: number, cy: number): number {
  if (!inGrid(grid, cx, cy)) return -fieldBand(grid);
  return grid.distance[cy * grid.widthCells + cx] ?? -fieldBand(grid);
}

/** One sample write: its slot and, optionally, its distance (default: the band, by the slot). */
export interface SampleWrite {
  cx: number;
  cy: number;
  slot: number;
  distance?: number;
}

/**
 * The one write path for terrain samples (terrain-field D6, blast-power D20): sets the slot and
 * the signed distance together, so "solid ⇔ distance > 0" always holds, and marks the chunk
 * dirty when either changes. Returns whether anything changed.
 */
export function writeSample(grid: TerrainGrid, write: SampleWrite): boolean {
  const { cx, cy, slot } = write;
  if (!inGrid(grid, cx, cy)) return false;
  const band = fieldBand(grid);
  const index = cy * grid.widthCells + cx;
  const distance = write.distance ?? (slot === EMPTY_CELL ? -band : band);
  if (grid.cells[index] === slot && grid.distance[index] === distance) return false;
  grid.cells[index] = slot;
  grid.distance[index] = distance;
  grid.dirtyChunks.add(chunkIndexOfCell(grid, cx, cy));
  return true;
}

/** Distance from a sample centre to the nearest empty sample centre within the band (else beyond). */
export function nearestEmptyDistance(grid: TerrainGrid, cx: number, cy: number): number {
  const reach = FIELD_BAND_SAMPLES;
  let best = Infinity;
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (getCellSlot(grid, cx + dx, cy + dy) !== EMPTY_CELL) continue;
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return Number.isFinite(best) ? best * grid.cellSize : (reach + 1) * grid.cellSize;
}

/**
 * Signed distance of this grid's own samples at a world point (positive inside), bilinear between
 * sample centres. Static terrain only; `fieldDistanceAt` adds the moving parts.
 */
export function gridDistanceAt(grid: TerrainGrid, p: Vec2): number {
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

// ── Moving parts (moving-parts D11) ─────────────────────────────────────────

/** Signed distance of one moving part at a world point, in a pose (default: its current one). */
export function moverDistanceAt(mover: MoverBody, p: Vec2, pose: MotionPose = mover.pose): number {
  const dx = p.x - mover.pivot.x - pose.dx;
  const dy = p.y - mover.pivot.y - pose.dy;
  if (dx * dx + dy * dy > mover.reach * mover.reach) return -fieldBand(mover.field);
  const rest = unposePoint(pose, mover.pivot, p);
  return gridDistanceAt(mover.field, { x: rest.x - mover.origin.x, y: rest.y - mover.origin.y });
}

/** The moving part deepest at a world point and its distance; null when the grid has none. */
export function moverAt(grid: TerrainGrid, p: Vec2): { mover: MoverBody; distance: number } | null {
  let best: { mover: MoverBody; distance: number } | null = null;
  for (const mover of grid.movers) {
    const distance = moverDistanceAt(mover, p);
    if (!best || distance > best.distance) best = { mover, distance };
  }
  return best;
}

/** Largest moving-part distance at a world point (−∞ without moving parts). */
export const moversDistanceAt = (grid: TerrainGrid, p: Vec2): number =>
  moverAt(grid, p)?.distance ?? -Infinity;

/** True when a moving part covers any point of the rect, edges excluded (samples ≤ half a cell apart). */
function rectHitsMovers(grid: TerrainGrid, rect: Rect): boolean {
  if (grid.movers.length === 0 || rect.w <= 0 || rect.h <= 0) return false;
  const step = grid.cellSize / 2;
  const nx = Math.max(1, Math.ceil(rect.w / step));
  const ny = Math.max(1, Math.ceil(rect.h / step));
  const inset = EDGE_EPSILON;
  for (let j = 0; j <= ny; j += 1) {
    const y = rect.y + inset + ((rect.h - inset * 2) * j) / ny;
    for (let i = 0; i <= nx; i += 1) {
      const x = rect.x + inset + ((rect.w - inset * 2) * i) / nx;
      if (moversDistanceAt(grid, { x, y }) > 0) return true;
    }
  }
  return false;
}

/** True when the world point lies in a non-empty cell or inside a moving part. */
export function isSolidAt(grid: TerrainGrid, x: number, y: number): boolean {
  const size = grid.cellSize;
  if (getCellSlot(grid, Math.floor(x / size), Math.floor(y / size)) !== EMPTY_CELL) return true;
  return moversDistanceAt(grid, { x, y }) > 0;
}

/** Cell range a world rect overlaps (edges touching a cell boundary do not count). */
export function cellRangeOf(grid: TerrainGrid, rect: Rect) {
  const size = grid.cellSize;
  return {
    minX: Math.floor(rect.x / size),
    minY: Math.floor(rect.y / size),
    maxX: Math.ceil((rect.x + rect.w) / size) - 1,
    maxY: Math.ceil((rect.y + rect.h) / size) - 1,
  };
}

/** True when any cell the rect overlaps is non-empty, or a moving part covers it. The collision query for bodies. */
export function rectHitsSolid(grid: TerrainGrid, rect: Rect): boolean {
  const range = cellRangeOf(grid, rect);
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      if (getCellSlot(grid, cx, cy) !== EMPTY_CELL) return true;
    }
  }
  return rectHitsMovers(grid, rect);
}

/**
 * Top of the first terrain surface under a span (x .. x + w) at or below `y`, scanning cell rows
 * down to `y + range`; null when there is none. For contact shadows of pickups and rockets.
 * Second copy: `features/player/services/playerController.ts` `scanGroundBelow` scans the same way
 * for the player body.
 */
export function surfaceBelow(
  grid: TerrainGrid,
  span: { x: number; y: number; w: number; range: number }
): number | null {
  const size = grid.cellSize;
  for (let top = Math.ceil(span.y / size) * size; top <= span.y + span.range; top += size) {
    if (rectHitsSolid(grid, { x: span.x, y: top, w: span.w, h: 1 })) return top;
  }
  return null;
}

/** Cells of one material + colour a blast removed. */
export interface ClearedLook {
  materialId: string;
  colorId: string;
  cells: number;
}

/** Inclusive sample range a write touched (empty when `minX > maxX`). */
export interface SampleBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * What a blast removed: total samples, the count per material + colour (destroy effects /
 * sounds), and the box of samples it wrote (the region a later loose-parts check floods, D20).
 */
export interface ClearedCells {
  removed: number;
  byLook: ClearedLook[];
  box: SampleBox;
}

const emptyBox = (): SampleBox => ({ minX: 1, minY: 1, maxX: 0, maxY: 0 });

function growBox(box: SampleBox, cx: number, cy: number): void {
  if (box.minX > box.maxX) Object.assign(box, { minX: cx, minY: cy, maxX: cx, maxY: cy });
  box.minX = Math.min(box.minX, cx);
  box.minY = Math.min(box.minY, cy);
  box.maxX = Math.max(box.maxX, cx);
  box.maxY = Math.max(box.maxY, cy);
}

function tallyLook(bySlot: Map<number, ClearedLook>, slot: number, info: TerrainCellSlot): void {
  const look = bySlot.get(slot) ?? { materialId: info.materialId, colorId: info.colorId, cells: 0 };
  look.cells += 1;
  bySlot.set(slot, look);
}

/**
 * Where a blast cuts terrain: its centre, its crater reach at toughness 1 (world units) and the
 * weapon's crater shape.
 */
export interface Crater {
  x: number;
  y: number;
  reach: number;
  shape: CraterShape;
}

/** How far a crater can change distances: its reach in the softest breakable material + the band. */
function craterSpan(grid: TerrainGrid, reach: number): number {
  const softest = Math.min(
    ...grid.slots.map((slot) => slot.toughness ?? Infinity).filter((t) => t > 0)
  );
  return Number.isFinite(softest) ? reach / softest + fieldBand(grid) : 0;
}

interface CraterPass {
  grid: TerrainGrid;
  crater: Crater;
  bySlot: Map<number, ClearedLook>;
  box: SampleBox;
}

/** Lowers one breakable sample's distance to the crater rim's; clears it once that reaches 0. */
function carveSample(pass: CraterPass, cx: number, cy: number): void {
  const { grid, crater } = pass;
  const slot = getCellSlot(grid, cx, cy);
  const info = grid.slots[slot];
  if (slot === EMPTY_CELL || !info || info.toughness === null || info.toughness <= 0) return;
  const dx = (cx + 0.5) * grid.cellSize - crater.x;
  const dy = (cy + 0.5) * grid.cellSize - crater.y;
  const rim = craterShapeDistance(crater.shape, dx, dy) - crater.reach / info.toughness;
  if (rim >= sampleDistance(grid, cx, cy)) return;
  const cleared = rim <= 0;
  writeSample(grid, { cx, cy, slot: cleared ? EMPTY_CELL : slot, distance: rim });
  growBox(pass.box, cx, cy);
  if (cleared) tallyLook(pass.bySlot, slot, info);
}

/**
 * Solid samples next to freshly emptied ones keep their old (interior or seam) distance; bound
 * it by the nearest now-empty sample so their edge reads as an edge (terrain-field D4). A crater
 * gives its breakable samples exact rim distances itself, so it bounds only `unbreakable` ones; a
 * burn-out has no rim shape and bounds `all` (fire-spread b1).
 */
function boundSolidsByNearestAir(
  grid: TerrainGrid,
  box: SampleBox,
  which: "unbreakable" | "all"
): void {
  const pad = FIELD_BAND_SAMPLES;
  for (let cy = box.minY - pad; cy <= box.maxY + pad; cy += 1) {
    for (let cx = box.minX - pad; cx <= box.maxX + pad; cx += 1) {
      const slot = getCellSlot(grid, cx, cy);
      if (slot === EMPTY_CELL) continue;
      if (which === "unbreakable" && isBreakableSlot(grid.slots[slot])) continue;
      const bound = Math.max(
        EDGE_EPSILON,
        nearestEmptyDistance(grid, cx, cy) - HALF_DIAGONAL * grid.cellSize
      );
      if (bound < sampleDistance(grid, cx, cy))
        writeSample(grid, { cx, cy, slot, distance: bound });
    }
  }
}

/** Air re-measures smaller than this (world units) are left alone: no redraw for rounding noise. */
const AIR_TOLERANCE = 0.05;

/**
 * Distance of an empty sample from the solid terrain still near it: the best of
 * (solid neighbour's distance − how far away it is) over solid samples within the band, else the
 * band. A path from the sample to a solid one crosses the edge, so this bounds the true distance
 * and is exact where the neighbour faces it (terrain-curves D9).
 */
function airDistance(grid: TerrainGrid, cx: number, cy: number): number {
  const reach = FIELD_BAND_SAMPLES;
  const band = fieldBand(grid);
  let best = -band;
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (getCellSlot(grid, cx + dx, cy + dy) === EMPTY_CELL) continue;
      const solid = sampleDistance(grid, cx + dx, cy + dy);
      best = Math.max(best, solid - Math.hypot(dx, dy) * grid.cellSize);
    }
  }
  return Math.min(-EDGE_EPSILON, best);
}

/**
 * Re-measures the empty samples around a fresh crater from the terrain that is left, so no
 * sample keeps the distance to an edge that no longer exists (a blasted-away platform leaves no
 * outline behind; terrain-curves D9).
 */
function remeasureAir(grid: TerrainGrid, box: SampleBox): void {
  // Only air within the band of a written sample can have measured to terrain that is now gone.
  const pad = FIELD_BAND_SAMPLES;
  for (let cy = box.minY - pad; cy <= box.maxY + pad; cy += 1) {
    for (let cx = box.minX - pad; cx <= box.maxX + pad; cx += 1) {
      if (cx < 0 || cy < 0 || cx >= grid.widthCells || cy >= grid.heightCells) continue;
      if (getCellSlot(grid, cx, cy) !== EMPTY_CELL) continue;
      const distance = airDistance(grid, cx, cy);
      if (Math.abs(distance - sampleDistance(grid, cx, cy)) < AIR_TOLERANCE) continue;
      writeSample(grid, { cx, cy, slot: EMPTY_CELL, distance });
    }
  }
}

/**
 * Blasts a crater out of the terrain (blast-power D1, terrain-field D4): each breakable sample's
 * distance is lowered to its distance from the crater rim, where the rim lies at
 * `shape distance = reach ÷ toughness`, so softer materials open wider and the rim is a true
 * curve between samples. A sample clears when its distance reaches 0; unbreakable samples stay.
 * Returns what was removed, per material + colour, and the box of samples it wrote.
 */
export function clearCrater(grid: TerrainGrid, crater: Crater): ClearedCells {
  const span = craterSpan(grid, crater.reach);
  const range = cellRangeOf(grid, {
    x: crater.x - span,
    y: crater.y - span,
    w: span * 2,
    h: span * 2,
  });
  const pass: CraterPass = { grid, crater, bySlot: new Map(), box: emptyBox() };
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) carveSample(pass, cx, cy);
  }
  const byLook = [...pass.bySlot.values()];
  const removed = byLook.reduce((sum, look) => sum + look.cells, 0);
  if (removed > 0) {
    boundSolidsByNearestAir(grid, pass.box, "unbreakable");
    remeasureAir(grid, pass.box);
  }
  return { removed, byLook, box: pass.box };
}

/**
 * Removes burnt-out samples (fire-spread b1) through the one writer, then keeps the field true
 * around them: neighbouring solids are bounded by the new air and the air is re-measured. Field
 * upkeep runs per chunk the removed samples fall in, never on one box spanning two far fires.
 * Samples already empty (a blast got there first) are skipped.
 */
interface BurnOutPass {
  grid: TerrainGrid;
  bySlot: Map<number, ClearedLook>;
  /** Removed samples' box per chunk: field upkeep runs per chunk. */
  byChunk: Map<number, SampleBox>;
  box: SampleBox;
}

/** Empties one burnt-out sample (skipped when already empty) and records where it was. */
function burnOutSample(pass: BurnOutPass, index: number): void {
  const { grid } = pass;
  const cx = index % grid.widthCells;
  const cy = Math.floor(index / grid.widthCells);
  const slot = getCellSlot(grid, cx, cy);
  const info = grid.slots[slot];
  if (slot === EMPTY_CELL || !info) return;
  writeSample(grid, { cx, cy, slot: EMPTY_CELL, distance: -EDGE_EPSILON });
  tallyLook(pass.bySlot, slot, info);
  const chunk = chunkIndexOfCell(grid, cx, cy);
  const chunkBox = pass.byChunk.get(chunk) ?? emptyBox();
  growBox(chunkBox, cx, cy);
  pass.byChunk.set(chunk, chunkBox);
  growBox(pass.box, cx, cy);
}

export function burnOut(grid: TerrainGrid, samples: readonly number[]): ClearedCells {
  const pass: BurnOutPass = { grid, bySlot: new Map(), byChunk: new Map(), box: emptyBox() };
  for (const index of samples) burnOutSample(pass, index);
  for (const chunkBox of pass.byChunk.values()) {
    boundSolidsByNearestAir(grid, chunkBox, "all");
    remeasureAir(grid, chunkBox);
  }
  const byLook = [...pass.bySlot.values()];
  return { removed: byLook.reduce((sum, look) => sum + look.cells, 0), byLook, box: pass.box };
}

/**
 * Friction of the ground directly under a span (the row of cells just below `y`): the average
 * over the solid cells there, 1 when there are none. Ice under the feet makes the blob slide.
 */
export function groundFrictionBelow(
  grid: TerrainGrid,
  span: { x: number; y: number; w: number }
): number {
  const range = cellRangeOf(grid, { x: span.x, y: span.y, w: span.w, h: 1 });
  let sum = 0;
  let count = 0;
  for (let cx = range.minX; cx <= range.maxX; cx += 1) {
    const info = getCellInfo(grid, cx, range.minY);
    if (!info) continue;
    sum += info.friction;
    count += 1;
  }
  if (count > 0) return sum / count;
  const under = moverAt(grid, { x: span.x + span.w / 2, y: span.y + grid.cellSize / 2 });
  return under && under.distance > 0 ? under.mover.friction : 1;
}

/** Returns the dirty chunk indices and clears the set (called by the renderer). */
export function takeDirtyChunks(grid: TerrainGrid): number[] {
  const dirty = [...grid.dirtyChunks];
  grid.dirtyChunks.clear();
  return dirty;
}
