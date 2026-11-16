import type { Circle, Rect } from "@/shared/types/gameGeometry.types";
import {
  EMPTY_CELL,
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
  destructible: false,
  friction: 1,
  surface: "plain",
};

export function createTerrainGrid(size: TerrainGridSize): TerrainGrid {
  const chunkCells = size.chunkCells ?? DEFAULT_CHUNK_CELLS;
  const chunksX = Math.ceil(size.widthCells / chunkCells);
  const chunksY = Math.ceil(size.heightCells / chunkCells);
  const dirtyChunks = new Set<number>();
  for (let i = 0; i < chunksX * chunksY; i += 1) dirtyChunks.add(i);
  return {
    cellSize: size.cellSize,
    widthCells: size.widthCells,
    heightCells: size.heightCells,
    cells: new Uint8Array(size.widthCells * size.heightCells),
    slots: [EMPTY_SLOT],
    chunkCells,
    chunksX,
    chunksY,
    dirtyChunks,
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

/** Writes one cell and marks its chunk dirty when the value changes. */
export function setCellSlot(
  grid: TerrainGrid,
  cell: { cx: number; cy: number; slot: number }
): void {
  const { cx, cy, slot } = cell;
  if (!inGrid(grid, cx, cy)) return;
  const index = cy * grid.widthCells + cx;
  if (grid.cells[index] === slot) return;
  grid.cells[index] = slot;
  grid.dirtyChunks.add(chunkIndexOfCell(grid, cx, cy));
}

/** True when the world point lies in a non-empty cell. */
export function isSolidAt(grid: TerrainGrid, x: number, y: number): boolean {
  const size = grid.cellSize;
  return getCellSlot(grid, Math.floor(x / size), Math.floor(y / size)) !== EMPTY_CELL;
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

/** True when any cell the rect overlaps is non-empty. The collision query for bodies. */
export function rectHitsSolid(grid: TerrainGrid, rect: Rect): boolean {
  const range = cellRangeOf(grid, rect);
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      if (getCellSlot(grid, cx, cy) !== EMPTY_CELL) return true;
    }
  }
  return false;
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

/** What a blast removed: total cells and the count per material + colour (destroy effects / sounds). */
export interface ClearedCells {
  removed: number;
  byLook: ClearedLook[];
}

function tallyLook(bySlot: Map<number, ClearedLook>, slot: number, info: TerrainCellSlot): void {
  const look = bySlot.get(slot) ?? { materialId: info.materialId, colorId: info.colorId, cells: 0 };
  look.cells += 1;
  bySlot.set(slot, look);
}

/**
 * Blasts a circle out of the terrain: destructible cells whose centre lies inside become empty;
 * other cells stay. Returns what was removed, per material + colour.
 */
export function clearCircle(grid: TerrainGrid, circle: Circle): ClearedCells {
  const range = cellRangeOf(grid, {
    x: circle.x - circle.radius,
    y: circle.y - circle.radius,
    w: circle.radius * 2,
    h: circle.radius * 2,
  });
  const radiusSq = circle.radius * circle.radius;
  const bySlot = new Map<number, ClearedLook>();
  for (let cy = range.minY; cy <= range.maxY; cy += 1) {
    for (let cx = range.minX; cx <= range.maxX; cx += 1) {
      const slot = getCellSlot(grid, cx, cy);
      const info = grid.slots[slot];
      if (slot === EMPTY_CELL || info?.destructible !== true) continue;
      const dx = (cx + 0.5) * grid.cellSize - circle.x;
      const dy = (cy + 0.5) * grid.cellSize - circle.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      setCellSlot(grid, { cx, cy, slot: EMPTY_CELL });
      tallyLook(bySlot, slot, info);
    }
  }
  const byLook = [...bySlot.values()];
  return { removed: byLook.reduce((sum, look) => sum + look.cells, 0), byLook };
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
  return count === 0 ? 1 : sum / count;
}

/** Returns the dirty chunk indices and clears the set (called by the renderer). */
export function takeDirtyChunks(grid: TerrainGrid): number[] {
  const dirty = [...grid.dirtyChunks];
  grid.dirtyChunks.clear();
  return dirty;
}
